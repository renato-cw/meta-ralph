'use client';

import { useCallback, useMemo } from 'react';
import {
  CIStatus,
  CICheck,
  CIOverallStatus,
  CI_STATUS_ICONS,
  CI_STATUS_COLORS,
} from '@/lib/types';
import { CIPollingState } from '@/hooks/useCIStatus';

/**
 * Props for CIStatusPanel component.
 */
export interface CIStatusPanelProps {
  /** Current CI status */
  status: CIStatus | null;
  /** Polling state */
  pollingState: CIPollingState;
  /** Error message if any */
  error: string | null;
  /** Time until next poll (ms) */
  nextPollIn: number;
  /** Number of polls made */
  pollCount: number;
  /** Whether CI awareness is enabled */
  isEnabled: boolean;
  /** Whether auto-fix is enabled */
  autoFixEnabled: boolean;
  /** Callback to refresh CI status */
  onRefresh: () => void;
  /** Callback to trigger auto-fix */
  onAutoFix?: () => void;
  /** Callback to view details on GitHub */
  onViewDetails?: (check: CICheck) => void;
}

/**
 * Format duration in a human-readable way.
 */
function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  if (durationMs < 1000) return '<1s';
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

/**
 * Get status badge for a check.
 */
function getCheckBadge(check: CICheck): { icon: string; text: string; className: string } {
  if (check.status === 'queued') {
    return {
      icon: CI_STATUS_ICONS.queued,
      text: 'Queued',
      className: 'bg-yellow-900/30 text-yellow-400',
    };
  }

  if (check.status === 'in_progress') {
    return {
      icon: CI_STATUS_ICONS.in_progress,
      text: 'Running',
      className: 'bg-blue-900/30 text-blue-400',
    };
  }

  // Completed - check conclusion
  switch (check.conclusion) {
    case 'success':
      return {
        icon: CI_STATUS_ICONS.success,
        text: 'Passed',
        className: 'bg-green-900/30 text-green-400',
      };
    case 'failure':
      return {
        icon: CI_STATUS_ICONS.failure,
        text: 'Failed',
        className: 'bg-red-900/30 text-red-400',
      };
    case 'cancelled':
      return {
        icon: '🚫',
        text: 'Cancelled',
        className: 'bg-gray-900/30 text-gray-400',
      };
    case 'skipped':
      return {
        icon: '⏭️',
        text: 'Skipped',
        className: 'bg-gray-900/30 text-gray-400',
      };
    case 'timed_out':
      return {
        icon: '⏰',
        text: 'Timed Out',
        className: 'bg-orange-900/30 text-orange-400',
      };
    default:
      return {
        icon: '❓',
        text: 'Unknown',
        className: 'bg-gray-900/30 text-gray-400',
      };
  }
}

/**
 * Individual check item component.
 */
function CICheckItem({
  check,
  onViewDetails,
}: {
  check: CICheck;
  onViewDetails?: (check: CICheck) => void;
}) {
  const badge = getCheckBadge(check);
  const duration = formatDuration(check.startedAt, check.completedAt);

  const handleClick = useCallback(() => {
    if (onViewDetails) {
      onViewDetails(check);
    } else if (check.detailsUrl) {
      window.open(check.detailsUrl, '_blank', 'noopener,noreferrer');
    }
  }, [check, onViewDetails]);

  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-md bg-gray-800/50 hover:bg-gray-800/70 cursor-pointer transition-colors"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`${check.name}: ${badge.text}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
          {badge.icon} {badge.text}
        </span>
        <span className="text-sm text-gray-300 truncate" title={check.name}>
          {check.name}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{duration}</span>
        <span className="text-gray-600">→</span>
      </div>
    </div>
  );
}

/**
 * Overall status header component.
 */
function CIStatusHeader({
  status,
  pollingState,
  nextPollIn,
}: {
  status: CIOverallStatus;
  pollingState: CIPollingState;
  nextPollIn: number;
}) {
  const colors = CI_STATUS_COLORS[status];
  const icon = CI_STATUS_ICONS[status];

  const statusText = {
    pending: 'CI Checks Pending',
    running: 'CI Running',
    success: 'CI Passed',
    failure: 'CI Failed',
    mixed: 'CI Partial Failure',
  }[status];

  const nextPollSeconds = Math.ceil(nextPollIn / 1000);

  return (
    <div className={`flex items-center justify-between p-3 rounded-t-lg ${colors.bg} border-b ${colors.border}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className={`font-medium ${colors.text}`}>{statusText}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {pollingState === 'polling' && (
          <span className="animate-pulse">Checking...</span>
        )}
        {pollingState === 'waiting' && nextPollSeconds > 0 && (
          <span>Next check in {nextPollSeconds}s</span>
        )}
      </div>
    </div>
  );
}

/**
 * Panel showing CI/CD status after pushing changes.
 * Displays check run statuses with refresh and auto-fix options.
 */
export function CIStatusPanel({
  status,
  pollingState,
  error,
  nextPollIn,
  pollCount,
  isEnabled,
  autoFixEnabled,
  onRefresh,
  onAutoFix,
  onViewDetails,
}: CIStatusPanelProps) {
  // Group checks by status
  const { failed, running, passed, other } = useMemo(() => {
    if (!status?.checks) {
      return { failed: [], running: [], passed: [], other: [] };
    }

    const failed: CICheck[] = [];
    const running: CICheck[] = [];
    const passed: CICheck[] = [];
    const other: CICheck[] = [];

    for (const check of status.checks) {
      if (check.conclusion === 'failure') {
        failed.push(check);
      } else if (check.status === 'in_progress') {
        running.push(check);
      } else if (check.conclusion === 'success') {
        passed.push(check);
      } else {
        other.push(check);
      }
    }

    return { failed, running, passed, other };
  }, [status?.checks]);

  const hasFailures = failed.length > 0;
  const canAutoFix = hasFailures && autoFixEnabled && onAutoFix;

  // If not enabled, show disabled state
  if (!isEnabled) {
    return (
      <div className="rounded-lg bg-gray-800/30 border border-gray-700 p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <span>⏸️</span>
          <span className="text-sm">CI/CD Awareness is disabled</span>
        </div>
      </div>
    );
  }

  // If no status yet, show loading/waiting state
  if (!status) {
    if (pollingState === 'idle') {
      return (
        <div className="rounded-lg bg-gray-800/30 border border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <span>🔌</span>
            <span className="text-sm">Waiting for push to start CI monitoring...</span>
          </div>
        </div>
      );
    }

    if (pollingState === 'polling') {
      return (
        <div className="rounded-lg bg-gray-800/30 border border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="animate-spin">⏳</span>
            <span className="text-sm">Fetching CI status...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg bg-red-900/20 border border-red-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <span>⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={onRefresh}
              className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-900/70 text-red-300 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="rounded-lg bg-gray-800/30 border border-gray-700 overflow-hidden">
      {/* Header with overall status */}
      {status && (
        <CIStatusHeader
          status={status.overallStatus}
          pollingState={pollingState}
          nextPollIn={nextPollIn}
        />
      )}

      {/* Check list */}
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {/* Failed checks first */}
        {failed.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-red-400 mb-1">
              Failed ({failed.length})
            </div>
            {failed.map((check) => (
              <CICheckItem
                key={check.id}
                check={check}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}

        {/* Running checks */}
        {running.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-blue-400 mb-1">
              Running ({running.length})
            </div>
            {running.map((check) => (
              <CICheckItem
                key={check.id}
                check={check}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}

        {/* Passed checks */}
        {passed.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-green-400 mb-1">
              Passed ({passed.length})
            </div>
            {passed.map((check) => (
              <CICheckItem
                key={check.id}
                check={check}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}

        {/* Other checks (queued, skipped, etc.) */}
        {other.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-400 mb-1">
              Other ({other.length})
            </div>
            {other.map((check) => (
              <CICheckItem
                key={check.id}
                check={check}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {status?.checks.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No CI checks found
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div className="p-3 border-t border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {status && (
            <>
              <span>Branch: {status.branch}</span>
              <span>•</span>
              <span className="font-mono">{status.sha.slice(0, 7)}</span>
              {pollCount > 0 && (
                <>
                  <span>•</span>
                  <span>{pollCount} polls</span>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canAutoFix && (
            <button
              onClick={onAutoFix}
              className="text-xs px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors"
            >
              🔧 Auto-Fix CI
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={pollingState === 'polling'}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 pb-3">
          <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

export default CIStatusPanel;
