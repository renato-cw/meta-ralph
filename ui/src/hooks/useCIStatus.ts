/**
 * useCIStatus Hook
 *
 * Polls GitHub API for CI check run status after push operations.
 * Supports auto-retry, status tracking, and callbacks for CI completion/failure.
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CICheck,
  CIStatus,
  CIStatusResponse,
  CIFailure,
  CIConfig,
  DEFAULT_CI_CONFIG,
} from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface UseCIStatusOptions {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Commit SHA to check */
  sha: string;
  /** PR URL for display purposes */
  prUrl?: string;
  /** Configuration overrides */
  config?: Partial<CIConfig>;
  /** Callback when all checks pass */
  onSuccess?: (response: CIStatusResponse) => void;
  /** Callback when any check fails */
  onFailure?: (response: CIStatusResponse, failures: CIFailure[]) => void;
  /** Callback on each status update */
  onUpdate?: (response: CIStatusResponse) => void;
}

export interface UseCIStatusReturn {
  /** Current CI status response */
  status: CIStatusResponse | null;
  /** Whether currently polling */
  isPolling: boolean;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Overall status */
  overallStatus: CIStatus | null;
  /** Failed checks with details */
  failures: CIFailure[];
  /** Start polling */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Manually refresh status */
  refresh: () => Promise<void>;
  /** Trigger auto-fix for failures */
  triggerAutoFix: () => Promise<boolean>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCIStatus({
  owner,
  repo,
  sha,
  prUrl,
  config: configOverrides,
  onSuccess,
  onFailure,
  onUpdate,
}: UseCIStatusOptions): UseCIStatusReturn {
  // Merge config with defaults
  const config: CIConfig = {
    ...DEFAULT_CI_CONFIG,
    ...configOverrides,
  };

  // State
  const [status, setStatus] = useState<CIStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for polling management
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const isPollingRef = useRef(false);
  const previousOverallStatus = useRef<CIStatus | null>(null);

  /**
   * Fetch CI status from API.
   */
  const fetchStatus = useCallback(async (): Promise<CIStatusResponse | null> => {
    if (!sha || !owner || !repo) {
      return null;
    }

    try {
      const response = await fetch(
        `/api/ci/status?sha=${encodeURIComponent(sha)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: CIStatusResponse = await response.json();

      // Add PR URL if provided
      if (prUrl && !data.prUrl) {
        data.prUrl = prUrl;
      }

      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to fetch CI status: ${message}`);
    }
  }, [sha, owner, repo, prUrl]);

  /**
   * Process status update and trigger callbacks.
   */
  const processStatusUpdate = useCallback(
    (newStatus: CIStatusResponse) => {
      setStatus(newStatus);
      onUpdate?.(newStatus);

      // Check if status changed to terminal state
      const prevStatus = previousOverallStatus.current;
      const newOverall = newStatus.overallStatus;
      previousOverallStatus.current = newOverall;

      if (prevStatus !== newOverall) {
        if (newOverall === 'success') {
          onSuccess?.(newStatus);
        } else if (newOverall === 'failure') {
          onFailure?.(newStatus, newStatus.failures);
        }
      }
    },
    [onSuccess, onFailure, onUpdate]
  );

  /**
   * Single refresh of CI status.
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newStatus = await fetchStatus();
      if (newStatus) {
        processStatusUpdate(newStatus);
        retryCount.current = 0;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      retryCount.current++;

      if (retryCount.current >= config.maxRetries) {
        stopPolling();
        setError(`CI status check failed after ${config.maxRetries} retries: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, processStatusUpdate, config.maxRetries]);

  /**
   * Start polling for CI status.
   */
  const startPolling = useCallback(() => {
    if (!config.enabled || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);
    retryCount.current = 0;

    // Initial fetch
    refresh();

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      // Don't poll if we reached a terminal state
      if (status?.overallStatus === 'success' || status?.overallStatus === 'failure') {
        stopPolling();
        return;
      }

      refresh();
    }, config.pollInterval);
  }, [config.enabled, config.pollInterval, refresh, status?.overallStatus]);

  /**
   * Stop polling for CI status.
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
    setIsPolling(false);
  }, []);

  /**
   * Trigger auto-fix for CI failures.
   */
  const triggerAutoFix = useCallback(async (): Promise<boolean> => {
    if (!status?.failures.length) {
      return false;
    }

    try {
      const response = await fetch('/api/ci/fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          sha,
          failures: status.failures,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Auto-fix failed: ${message}`);
      return false;
    }
  }, [owner, repo, sha, status?.failures]);

  // Stop polling on terminal status
  useEffect(() => {
    if (
      status?.overallStatus === 'success' ||
      status?.overallStatus === 'failure' ||
      status?.overallStatus === 'cancelled'
    ) {
      stopPolling();
    }
  }, [status?.overallStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Derived state
  const overallStatus = status?.overallStatus ?? null;
  const failures = status?.failures ?? [];

  return {
    status,
    isPolling,
    isLoading,
    error,
    overallStatus,
    failures,
    startPolling,
    stopPolling,
    refresh,
    triggerAutoFix,
  };
}

/**
 * Get display icon for CI status.
 */
export function getCIStatusIcon(status: CIStatus | null): string {
  switch (status) {
    case 'pending':
      return '🟡';
    case 'running':
      return '⏳';
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    case 'cancelled':
      return '⚪';
    case 'skipped':
      return '⏭️';
    default:
      return '❓';
  }
}

/**
 * Get display color class for CI status.
 */
export function getCIStatusColor(status: CIStatus | null): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500';
    case 'running':
      return 'text-blue-500';
    case 'success':
      return 'text-green-500';
    case 'failure':
      return 'text-red-500';
    case 'cancelled':
      return 'text-gray-500';
    case 'skipped':
      return 'text-gray-400';
    default:
      return 'text-gray-500';
  }
}

export default useCIStatus;
