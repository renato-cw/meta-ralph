'use client';

import type { Issue } from '@/lib/types';

type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface QueueItemProps {
  issue: Issue;
  status: QueueItemStatus;
  startedAt?: string;
  completedAt?: string;
  prUrl?: string;
  error?: string;
  /** Whether the push failed (processing succeeded but push didn't) */
  pushFailed?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  /** Callback to retry a failed push */
  onRetryPush?: () => void;
}

const STATUS_STYLES: Record<QueueItemStatus, { bg: string; text: string; icon: string }> = {
  pending: {
    bg: 'bg-gray-800/50',
    text: 'text-gray-400',
    icon: 'clock',
  },
  processing: {
    bg: 'bg-blue-900/30',
    text: 'text-blue-400',
    icon: 'spinner',
  },
  completed: {
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    icon: 'check',
  },
  failed: {
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    icon: 'x',
  },
};

function StatusIcon({ status }: { status: QueueItemStatus }) {
  const iconType = STATUS_STYLES[status].icon;

  switch (iconType) {
    case 'clock':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'spinner':
      return (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    case 'check':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'x':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return null;
  }
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000);

  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
}

/**
 * Individual item in the processing queue.
 * Shows issue info, status, and available actions.
 */
export function QueueItem({
  issue,
  status,
  startedAt,
  completedAt,
  prUrl,
  error,
  pushFailed,
  onCancel,
  onRetry,
  onRetryPush,
}: QueueItemProps) {
  const styles = STATUS_STYLES[status];
  const duration = formatDuration(startedAt, completedAt);

  return (
    <div className={`${styles.bg} rounded-lg p-3 border border-[var(--border)]`}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={`${styles.text} mt-0.5`}>
          <StatusIcon status={status} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{issue.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${styles.bg} ${styles.text}`}>
              {status}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
            <span className="font-mono">{issue.provider}</span>
            <span>{issue.severity}</span>
            {duration && <span>{duration}</span>}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
              {error}
            </div>
          )}

          {/* PR Link */}
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View PR
            </a>
          )}

          {/* Push failed warning */}
          {pushFailed && !prUrl && (
            <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded p-2 flex items-center gap-2">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Push failed - changes committed but not pushed</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {status === 'pending' && onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded transition-colors"
              title="Remove from queue"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {status === 'failed' && onRetry && (
            <button
              onClick={onRetry}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded transition-colors"
              title="Retry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {/* Retry push button for completed items with failed push */}
          {pushFailed && !prUrl && onRetryPush && (
            <button
              onClick={onRetryPush}
              className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 rounded transition-colors"
              title="Retry push"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
