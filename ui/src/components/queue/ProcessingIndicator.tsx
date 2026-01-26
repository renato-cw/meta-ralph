'use client';

import type { ProcessingStatus } from '@/lib/types';

interface ProcessingIndicatorProps {
  processing: ProcessingStatus;
  isQueueOpen: boolean;
  onOpenQueue: () => void;
}

/**
 * Floating indicator that shows when processing is active but the queue panel is closed.
 * Allows users to quickly see status and open the queue panel.
 */
export function ProcessingIndicator({
  processing,
  isQueueOpen,
  onOpenQueue,
}: ProcessingIndicatorProps) {
  // Don't show if queue is open or not processing
  if (isQueueOpen || !processing.isProcessing) {
    return null;
  }

  const completed = processing.completed.length;
  const failed = processing.failed.length;

  return (
    <button
      onClick={onOpenQueue}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
      title="Click to open processing queue"
    >
      {/* Animated spinner */}
      <div className="relative">
        <svg
          className="w-6 h-6 animate-spin text-[var(--primary)]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-20"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-full bg-[var(--primary)] animate-ping opacity-20" />
      </div>

      {/* Status text */}
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Processing...
        </span>
        <span className="text-xs text-[var(--muted)]">
          {completed > 0 && (
            <span className="text-green-400">{completed} done</span>
          )}
          {completed > 0 && failed > 0 && ' · '}
          {failed > 0 && (
            <span className="text-red-400">{failed} failed</span>
          )}
          {completed === 0 && failed === 0 && 'Starting...'}
        </span>
      </div>

      {/* Arrow icon */}
      <svg
        className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}
