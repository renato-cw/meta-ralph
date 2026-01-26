'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CIStatus,
  CICheck,
  CIOverallStatus,
  CIPollingConfig,
  DEFAULT_CI_POLLING_CONFIG,
  CIFixRequest,
  CIFixResponse,
} from '@/lib/types';

/**
 * CI polling state.
 */
export type CIPollingState = 'idle' | 'polling' | 'waiting' | 'error';

/**
 * Options for the useCIStatus hook.
 */
export interface UseCIStatusOptions {
  /** Branch being monitored */
  branch: string;
  /** SHA of the commit being monitored */
  sha: string;
  /** Whether CI awareness is enabled */
  enabled?: boolean;
  /** Polling configuration */
  config?: Partial<CIPollingConfig>;
  /** Callback when CI completes */
  onComplete?: (status: CIOverallStatus, checks: CICheck[]) => void;
  /** Callback when CI fails and auto-fix is triggered */
  onAutoFix?: (failedChecks: CICheck[]) => void;
}

/**
 * Return value from the useCIStatus hook.
 */
export interface UseCIStatusReturn {
  /** Current CI status */
  status: CIStatus | null;
  /** Polling state */
  pollingState: CIPollingState;
  /** Error message if any */
  error: string | null;
  /** Time remaining until next poll (ms) */
  nextPollIn: number;
  /** Number of polls made */
  pollCount: number;
  /** Start polling */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Manually refresh CI status */
  refresh: () => Promise<void>;
  /** Trigger auto-fix for failed checks */
  triggerAutoFix: (issueId: string) => Promise<CIFixResponse>;
  /** Get failed checks */
  getFailedChecks: () => CICheck[];
}

/**
 * Compute overall CI status from individual checks.
 */
export function computeOverallStatus(checks: CICheck[]): CIOverallStatus {
  if (checks.length === 0) return 'pending';

  const hasRunning = checks.some(c => c.status === 'in_progress');
  const hasPending = checks.some(c => c.status === 'queued');
  const allCompleted = checks.every(c => c.status === 'completed');

  if (hasRunning) return 'running';
  if (hasPending) return 'pending';

  if (allCompleted) {
    const hasFailure = checks.some(c => c.conclusion === 'failure');
    const hasSuccess = checks.some(c => c.conclusion === 'success');

    if (hasFailure && hasSuccess) return 'mixed';
    if (hasFailure) return 'failure';
    return 'success';
  }

  return 'pending';
}

/**
 * Hook for monitoring CI/CD status after pushing changes.
 * Polls GitHub Actions check runs and supports auto-fix on failure.
 *
 * @example
 * ```tsx
 * const {
 *   status,
 *   pollingState,
 *   startPolling,
 *   triggerAutoFix,
 * } = useCIStatus({
 *   branch: 'fix/issue-123',
 *   sha: 'abc123',
 *   enabled: processingOptions.ciAwareness,
 *   onComplete: (status) => {
 *     if (status === 'failure' && processingOptions.autoFixCi) {
 *       // Auto-fix will be triggered automatically
 *     }
 *   },
 * });
 * ```
 */
export function useCIStatus({
  branch,
  sha,
  enabled = true,
  config: configOverrides = {},
  onComplete,
  onAutoFix,
}: UseCIStatusOptions): UseCIStatusReturn {
  // Merge config with defaults
  const config: CIPollingConfig = {
    ...DEFAULT_CI_POLLING_CONFIG,
    ...configOverrides,
  };

  const [status, setStatus] = useState<CIStatus | null>(null);
  const [pollingState, setPollingState] = useState<CIPollingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number>(0);
  const [pollCount, setPollCount] = useState<number>(0);

  // Refs for interval management
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const pollCountRef = useRef<number>(0);

  // Fetch CI status from API
  const fetchStatus = useCallback(async (): Promise<CIStatus | null> => {
    try {
      const params = new URLSearchParams({
        branch,
        sha,
      });

      const response = await fetch(`/api/ci/status?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data as CIStatus;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch CI status');
    }
  }, [branch, sha]);

  // Single poll iteration
  const poll = useCallback(async () => {
    if (!isPollingRef.current || !enabled) return;

    pollCountRef.current += 1;
    setPollCount(pollCountRef.current);

    // Check max retries
    if (pollCountRef.current > config.maxRetries) {
      setPollingState('error');
      setError('Maximum polling attempts reached');
      isPollingRef.current = false;
      return;
    }

    try {
      setPollingState('polling');
      const newStatus = await fetchStatus();

      if (newStatus) {
        setStatus(newStatus);
        setError(null);

        // Check if CI is complete
        const overall = newStatus.overallStatus;
        if (overall === 'success' || overall === 'failure' || overall === 'mixed') {
          // CI is complete
          isPollingRef.current = false;
          setPollingState('idle');
          onComplete?.(overall, newStatus.checks);

          // If failure and auto-fix callback provided, call it
          if ((overall === 'failure' || overall === 'mixed') && onAutoFix) {
            const failedChecks = newStatus.checks.filter(
              c => c.conclusion === 'failure'
            );
            onAutoFix(failedChecks);
          }
          return;
        }
      }

      // Continue polling - set waiting state
      setPollingState('waiting');
      setNextPollIn(config.intervalMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPollingState('waiting');
      setNextPollIn(config.intervalMs);
    }
  }, [enabled, config.maxRetries, config.intervalMs, fetchStatus, onComplete, onAutoFix]);

  // Start polling
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;

    isPollingRef.current = true;
    pollCountRef.current = 0;
    setPollCount(0);
    setError(null);

    // Initial poll
    poll();

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      poll();
    }, config.intervalMs);

    // Set up countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setNextPollIn(prev => Math.max(0, prev - 1000));
    }, 1000);
  }, [poll, config.intervalMs]);

  // Stop polling
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    setPollingState('idle');

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    setPollingState('polling');
    try {
      const newStatus = await fetchStatus();
      if (newStatus) {
        setStatus(newStatus);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPollingState(isPollingRef.current ? 'waiting' : 'idle');
    }
  }, [fetchStatus]);

  // Trigger auto-fix
  const triggerAutoFix = useCallback(
    async (issueId: string): Promise<CIFixResponse> => {
      if (!status) {
        return {
          success: false,
          message: 'No CI status available',
          fixAttempted: false,
        };
      }

      const failedChecks = status.checks
        .filter(c => c.conclusion === 'failure')
        .map(c => c.name);

      if (failedChecks.length === 0) {
        return {
          success: false,
          message: 'No failed checks to fix',
          fixAttempted: false,
        };
      }

      const request: CIFixRequest = {
        issueId,
        sha: status.sha,
        branch: status.branch,
        failedChecks,
      };

      try {
        const response = await fetch('/api/ci/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            message: errorData.error || `HTTP ${response.status}`,
            fixAttempted: false,
          };
        }

        const data = await response.json();

        // If fix succeeded and new commit was made, restart polling
        if (data.success && data.newCommitSha) {
          pollCountRef.current = 0;
          startPolling();
        }

        return data as CIFixResponse;
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
          fixAttempted: false,
        };
      }
    },
    [status, startPolling]
  );

  // Get failed checks
  const getFailedChecks = useCallback((): CICheck[] => {
    if (!status) return [];
    return status.checks.filter(c => c.conclusion === 'failure');
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Reset when branch/sha changes
  useEffect(() => {
    setStatus(null);
    setPollCount(0);
    pollCountRef.current = 0;
    setError(null);
    setPollingState('idle');
  }, [branch, sha]);

  return {
    status,
    pollingState,
    error,
    nextPollIn,
    pollCount,
    startPolling,
    stopPolling,
    refresh,
    triggerAutoFix,
    getFailedChecks,
  };
}
