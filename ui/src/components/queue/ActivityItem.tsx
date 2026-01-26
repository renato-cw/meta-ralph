'use client';

import { Activity, TOOL_ICONS, TOOL_COLORS } from '@/lib/types';

/**
 * Props for the ActivityItem component.
 */
export interface ActivityItemProps {
  activity: Activity;
  isLast?: boolean;
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Get the status indicator element.
 */
function StatusIndicator({ status }: { status?: 'pending' | 'success' | 'error' }) {
  if (status === 'pending') {
    return (
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
    );
  }
  if (status === 'success') {
    return (
      <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return null;
}

/**
 * ActivityItem displays a single activity in the activity feed.
 * Shows tool icon, tool name, details, and status.
 */
export function ActivityItem({ activity, isLast = false }: ActivityItemProps) {
  const { type, tool, details, status, timestamp } = activity;

  // Get styling based on activity type
  const getActivityStyle = () => {
    if (type === 'error') {
      return { bg: 'bg-red-900/30', text: 'text-red-400' };
    }
    if (type === 'result') {
      return { bg: 'bg-green-900/30', text: 'text-green-400' };
    }
    if (type === 'message') {
      return { bg: 'bg-gray-800/50', text: 'text-gray-300' };
    }
    if (type === 'system') {
      return { bg: 'bg-cyan-900/30', text: 'text-cyan-400' };
    }
    if (type === 'tool' && tool) {
      return TOOL_COLORS[tool];
    }
    return { bg: 'bg-gray-800/50', text: 'text-gray-400' };
  };

  // Get icon based on activity type
  const getIcon = () => {
    if (type === 'error') return '❌';
    if (type === 'result') return '✅';
    if (type === 'message') return '💬';
    if (type === 'system') return '⚙️';
    if (type === 'tool' && tool) {
      return TOOL_ICONS[tool];
    }
    return '📋';
  };

  // Get label text
  const getLabel = () => {
    if (type === 'error') return 'Error';
    if (type === 'result') return 'Result';
    if (type === 'message') return 'Claude';
    if (type === 'system') return 'System';
    if (type === 'tool' && tool) return tool;
    return 'Activity';
  };

  const style = getActivityStyle();

  return (
    <div
      className={`
        flex items-start gap-3 px-3 py-2 rounded-lg
        ${style.bg}
        ${isLast ? 'ring-1 ring-blue-500/50' : ''}
        transition-all duration-150
      `}
      data-testid="activity-item"
    >
      {/* Icon */}
      <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
        {getIcon()}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${style.text}`}>
            {getLabel()}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimestamp(timestamp)}
          </span>
          <StatusIndicator status={status} />
        </div>

        {/* Details */}
        {details && (
          <p className="text-sm text-gray-400 mt-0.5 truncate" title={details}>
            {details}
          </p>
        )}
      </div>
    </div>
  );
}
