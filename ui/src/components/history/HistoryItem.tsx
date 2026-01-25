'use client';

import type { HistoryEntry } from '@/lib/types';

interface HistoryItemProps {
  entry: HistoryEntry;
  onRetry?: (entry: HistoryEntry) => void;
  onRemove?: (entry: HistoryEntry) => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    INFO: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return colors[severity] || colors.INFO;
}

function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    zeropath: 'bg-purple-500/20 text-purple-400',
    sentry: 'bg-pink-500/20 text-pink-400',
    codecov: 'bg-blue-500/20 text-blue-400',
    github: 'bg-gray-500/20 text-gray-400',
  };
  return colors[provider] || 'bg-gray-500/20 text-gray-400';
}

export function HistoryItem({ entry, onRetry, onRemove }: HistoryItemProps) {
  const isCompleted = entry.status === 'completed';

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isCompleted
          ? 'bg-[var(--card)] border-[var(--border)]'
          : 'bg-red-900/10 border-red-800/30'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status indicator */}
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isCompleted ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={isCompleted ? 'Completed' : 'Failed'}
          />

          {/* Title */}
          <span className="font-medium text-sm truncate" title={entry.issueTitle}>
            {entry.issueTitle}
          </span>
        </div>

        {/* Time */}
        <span className="text-xs text-[var(--muted)] flex-shrink-0">
          {formatDate(entry.completedAt)}
        </span>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {/* Provider badge */}
        <span className={`px-1.5 py-0.5 rounded ${getProviderColor(entry.provider)}`}>
          {entry.provider}
        </span>

        {/* Severity badge */}
        <span
          className={`px-1.5 py-0.5 rounded border ${getSeverityColor(entry.severity)}`}
        >
          {entry.severity}
        </span>

        {/* Duration */}
        {entry.duration > 0 && (
          <span className="text-[var(--muted)]">{formatDuration(entry.duration)}</span>
        )}

        {/* Issue ID */}
        <span className="text-[var(--muted)] font-mono text-[10px]">
          {entry.issueId.slice(0, 12)}...
        </span>
      </div>

      {/* Error message for failed entries */}
      {!isCompleted && entry.error && (
        <div className="mt-2 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
          {entry.error}
        </div>
      )}

      {/* PR link for completed entries */}
      {isCompleted && entry.prUrl && (
        <div className="mt-2">
          <a
            href={entry.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
            </svg>
            View PR
          </a>
        </div>
      )}

      {/* Actions */}
      {(onRetry || onRemove) && (
        <div className="mt-2 flex items-center gap-2 pt-2 border-t border-[var(--border)]">
          {!isCompleted && onRetry && (
            <button
              onClick={() => onRetry(entry)}
              className="text-xs px-2 py-1 rounded bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(entry)}
              className="text-xs px-2 py-1 rounded text-[var(--muted)] hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
