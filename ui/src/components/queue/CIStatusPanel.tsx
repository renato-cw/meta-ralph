/**
 * CIStatusPanel Component
 *
 * Displays CI/CD check run status with real-time updates.
 * Shows individual check statuses, overall status, and failure details.
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

'use client';

import { useState, useCallback } from 'react';
import {
  CICheck,
  CIStatus,
  CIStatusResponse,
  CIFailure,
} from '@/lib/types';
import { getCIStatusIcon, getCIStatusColor } from '@/hooks/useCIStatus';

// ============================================================================
// Types
// ============================================================================

interface CIStatusPanelProps {
  /** CI status response data */
  status: CIStatusResponse | null;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Whether currently polling */
  isPolling?: boolean;
  /** GitHub repository owner */
  owner?: string;
  /** GitHub repository name */
  repo?: string;
  /** Callback to manually refresh status */
  onRefresh?: () => void;
  /** Callback to trigger auto-fix */
  onAutoFix?: () => Promise<boolean>;
  /** Whether to show the panel header */
  showHeader?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Individual check item display.
 */
function CheckItem({ check }: { check: CICheck }) {
  const icon = getCIStatusIcon(check.status);
  const colorClass = getCIStatusColor(check.status);
  const duration = check.completedAt && check.startedAt
    ? formatDuration(new Date(check.startedAt), new Date(check.completedAt))
    : check.status === 'running'
    ? 'Running...'
    : check.status === 'pending'
    ? 'Waiting...'
    : null;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${colorClass}`}>{icon}</span>
        <span className="text-sm text-foreground">{check.name}</span>
      </div>
      <div className="flex items-center gap-3">
        {duration && (
          <span className="text-xs text-muted-foreground">{duration}</span>
        )}
        <a
          href={check.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 hover:underline"
        >
          View
        </a>
      </div>
    </div>
  );
}

/**
 * Failure details display.
 */
function FailureDetails({ failure, owner: _owner, repo: _repo, onShowLogs: _onShowLogs }: {
  failure: CIFailure;
  owner?: string;
  repo?: string;
  onShowLogs?: (checkName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-red-500/30 rounded-md bg-red-500/5 p-3 mt-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-red-500">❌</span>
            <span className="font-medium text-sm text-red-400">{failure.checkName}</span>
          </div>
          <p className="text-xs text-red-300 mt-1">{failure.error}</p>
        </div>
        {failure.logs && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-500 hover:text-blue-400 ml-2"
          >
            {expanded ? 'Hide' : 'Show'} logs
          </button>
        )}
      </div>
      {expanded && failure.logs && (
        <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
          {failure.logs}
        </pre>
      )}
    </div>
  );
}

/**
 * Format duration between two dates.
 */
function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Overall status badge.
 */
function StatusBadge({ status }: { status: CIStatus }) {
  const icon = getCIStatusIcon(status);
  const colorClass = getCIStatusColor(status);

  const labels: Record<CIStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    success: 'Passed',
    failure: 'Failed',
    cancelled: 'Cancelled',
    skipped: 'Skipped',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${colorClass} bg-current/10`}>
      <span>{icon}</span>
      <span>{labels[status]}</span>
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CIStatusPanel({
  status,
  isLoading = false,
  error = null,
  isPolling = false,
  owner,
  repo,
  onRefresh,
  onAutoFix,
  showHeader = true,
  className = '',
}: CIStatusPanelProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  /**
   * Handle auto-fix button click.
   */
  const handleAutoFix = useCallback(async () => {
    if (!onAutoFix) return;

    setIsFixing(true);
    setFixError(null);

    try {
      const success = await onAutoFix();
      if (!success) {
        setFixError('Auto-fix failed. Please try manually.');
      }
    } catch (e) {
      setFixError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsFixing(false);
    }
  }, [onAutoFix]);

  // Empty state
  if (!status && !isLoading && !error) {
    return (
      <div className={`p-4 text-center text-muted-foreground ${className}`}>
        <p className="text-sm">No CI status available</p>
        <p className="text-xs mt-1">CI status will appear after pushing changes</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">CI/CD Status</h3>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-xs text-blue-500 hover:text-blue-400"
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !status) {
    return (
      <div className={`p-4 ${className}`}>
        {showHeader && (
          <h3 className="text-sm font-medium text-foreground mb-3">CI/CD Status</h3>
        )}
        <div className="flex items-center justify-center gap-2 py-4">
          <span className="animate-spin text-blue-500">⏳</span>
          <span className="text-sm text-muted-foreground">Loading CI status...</span>
        </div>
      </div>
    );
  }

  // Main display
  return (
    <div className={`p-4 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-foreground">CI/CD Status</h3>
            {status && <StatusBadge status={status.overallStatus} />}
            {isPolling && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Polling...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-50"
              >
                Refresh
              </button>
            )}
            {status?.prUrl && (
              <a
                href={status.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400"
              >
                View on GitHub
              </a>
            )}
          </div>
        </div>
      )}

      {/* SHA info */}
      {status?.sha && (
        <div className="text-xs text-muted-foreground mb-3">
          Commit: <code className="bg-white/5 px-1 rounded">{status.sha.slice(0, 7)}</code>
        </div>
      )}

      {/* Check runs list */}
      {status?.checks && status.checks.length > 0 && (
        <div className="space-y-1 mb-3">
          {status.checks.map((check) => (
            <CheckItem key={check.id} check={check} />
          ))}
        </div>
      )}

      {/* Failure details */}
      {status?.failures && status.failures.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-red-400 mb-2">
            Failures ({status.failures.length})
          </h4>
          {status.failures.map((failure, index) => (
            <FailureDetails
              key={index}
              failure={failure}
              owner={owner}
              repo={repo}
            />
          ))}

          {/* Auto-fix button */}
          {onAutoFix && (
            <button
              onClick={handleAutoFix}
              disabled={isFixing}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {isFixing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Fixing...</span>
                </>
              ) : (
                <>
                  <span>🔧</span>
                  <span>Auto-Fix CI</span>
                </>
              )}
            </button>
          )}

          {/* Fix error */}
          {fixError && (
            <p className="mt-2 text-xs text-red-400">{fixError}</p>
          )}
        </div>
      )}

      {/* Success message */}
      {status?.overallStatus === 'success' && (
        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <span>✅</span>
            <span>All checks passed!</span>
          </p>
        </div>
      )}

      {/* Last updated */}
      {status?.lastUpdated && (
        <div className="mt-3 text-xs text-muted-foreground text-right">
          Last updated: {new Date(status.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default CIStatusPanel;
