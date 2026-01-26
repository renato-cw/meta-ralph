'use client';

import { forwardRef, useCallback } from 'react';
import {
  Activity,
  ExecutionMetrics,
  ToolName,
  ActivityStatus,
} from '@/lib/types';
import { getActivityStatusClasses, TOOL_ICONS } from '@/lib/events';

// ============================================================================
// Props Interface
// ============================================================================

interface ActivityFeedProps {
  /** Activities to display */
  activities: Activity[];
  /** Current execution metrics */
  metrics: ExecutionMetrics | null;
  /** Whether processing is active */
  isProcessing: boolean;
  /** Whether auto-scroll is enabled */
  autoScroll?: boolean;
  /** Toggle auto-scroll callback */
  onToggleAutoScroll?: () => void;
  /** Maximum height for the feed container */
  maxHeight?: string;
}

// ============================================================================
// Icon Components
// ============================================================================

/**
 * Get SVG icon for activity type/tool.
 */
function ActivityIcon({ activity }: { activity: Activity }) {
  const { type, tool, status } = activity;

  // Get color classes based on status
  const statusClasses = getActivityStatusClasses(status);

  // Tool-specific icons
  if (type === 'tool' && tool) {
    return (
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-md ${statusClasses.bg} ${statusClasses.text}`}
        title={tool}
      >
        {TOOL_ICONS[tool] ?? getToolSvgIcon(tool)}
      </span>
    );
  }

  // Activity type icons
  switch (type) {
    case 'message':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500/10 text-blue-400">
          <MessageIcon />
        </span>
      );
    case 'result':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-green-500/10 text-green-400">
          <CheckIcon />
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-red-500/10 text-red-400">
          <ErrorIcon />
        </span>
      );
    case 'push':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-500/10 text-purple-400">
          <PushIcon />
        </span>
      );
    case 'ci':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-400">
          <CIIcon />
        </span>
      );
    default:
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-500/10 text-gray-400">
          <InfoIcon />
        </span>
      );
  }
}

function getToolSvgIcon(tool: ToolName): React.ReactNode {
  switch (tool) {
    case 'Read':
      return <ReadIcon />;
    case 'Write':
      return <WriteIcon />;
    case 'Edit':
      return <EditIcon />;
    case 'Bash':
      return <BashIcon />;
    case 'Glob':
    case 'Grep':
      return <SearchIcon />;
    default:
      return <ToolIcon />;
  }
}

// SVG Icon Components
function ReadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function WriteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function BashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PushIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function CIIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ============================================================================
// Status Indicator
// ============================================================================

function StatusIndicator({ status }: { status?: ActivityStatus }) {
  if (!status) return null;

  const statusClasses = getActivityStatusClasses(status);

  if (status === 'running') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${statusClasses.bg} ${statusClasses.text}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        Running
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${statusClasses.bg} ${statusClasses.text}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        Pending
      </span>
    );
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Real-time activity feed showing Claude's actions during processing.
 */
export const ActivityFeed = forwardRef<HTMLDivElement, ActivityFeedProps>(
  function ActivityFeed(
    {
      activities,
      metrics,
      isProcessing,
      autoScroll = true,
      onToggleAutoScroll,
      maxHeight = '400px',
    },
    ref
  ) {
    // Format timestamp for display
    const formatTime = useCallback((timestamp: string) => {
      try {
        return new Date(timestamp).toLocaleTimeString();
      } catch {
        return timestamp;
      }
    }, []);

    // Format duration for display
    const formatDuration = useCallback((ms: number | undefined) => {
      if (!ms) return '';
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    }, []);

    // Empty state
    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] p-8">
          {isProcessing ? (
            <>
              <svg className="w-12 h-12 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm">Waiting for activity...</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Start processing to see actions</p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header with auto-scroll toggle */}
        {onToggleAutoScroll && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--muted)]">
              {activities.length} activities
            </span>
            <button
              onClick={onToggleAutoScroll}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                autoScroll
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-gray-500/10 text-[var(--muted)]'
              }`}
            >
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
          </div>
        )}

        {/* Activity list */}
        <div
          ref={ref}
          className="flex-1 overflow-y-auto p-4 space-y-2"
          style={{ maxHeight }}
        >
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--card)] transition-colors group"
            >
              <div className="flex-shrink-0 mt-0.5">
                <ActivityIcon activity={activity} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--foreground)]">
                    {activity.details || getActivityDescription(activity)}
                  </p>
                  <StatusIndicator status={activity.status} />
                </div>
                {activity.tool && (
                  <p className="text-xs text-[var(--muted)] font-mono">
                    {activity.tool}
                    {activity.duration && ` - ${formatDuration(activity.duration)}`}
                  </p>
                )}
              </div>
              <span className="text-xs text-[var(--muted)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          ))}
        </div>

        {/* Metrics footer */}
        {metrics && (
          <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--card)]/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--muted)]">
                Iteration {metrics.iteration}/{metrics.maxIterations}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--muted)]">
                  ${metrics.totalCostUsd.toFixed(4)}
                </span>
                <span className="text-[var(--muted)]">
                  {formatDuration(metrics.totalDurationMs)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

/**
 * Get default description for activity based on type.
 */
function getActivityDescription(activity: Activity): string {
  switch (activity.type) {
    case 'tool':
      return activity.tool ? `Using ${activity.tool}` : 'Tool execution';
    case 'message':
      return 'Claude message';
    case 'result':
      return 'Iteration complete';
    case 'error':
      return 'Error occurred';
    case 'push':
      return 'Pushing changes';
    case 'ci':
      return 'CI/CD status';
    default:
      return 'Activity';
  }
}

export default ActivityFeed;
