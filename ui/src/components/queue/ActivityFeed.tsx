'use client';

export interface Activity {
  id: string;
  type: 'read' | 'edit' | 'bash' | 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
  file?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  metrics: ExecutionMetrics | null;
  isProcessing: boolean;
}

export interface ExecutionMetrics {
  cost: number;
  duration: number;
  iteration: number;
  maxIterations: number;
}

/**
 * Real-time activity feed showing Claude's actions.
 */
export function ActivityFeed({ activities, isProcessing }: ActivityFeedProps) {
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'read':
        return (
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      case 'edit':
        return (
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'bash':
        return (
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

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
    <div className="p-4 space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
        >
          <div className="flex-shrink-0 mt-0.5">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--foreground)]">{activity.message}</p>
            {activity.file && (
              <p className="text-xs text-[var(--muted)] font-mono truncate">{activity.file}</p>
            )}
          </div>
          <span className="text-xs text-[var(--muted)] flex-shrink-0">
            {activity.timestamp.toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
