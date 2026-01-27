'use client';

import { ExecutionMetrics } from '@/lib/types';

interface MetricsDisplayProps {
  metrics: ExecutionMetrics | null;
  isProcessing: boolean;
}

/**
 * Displays execution metrics: cost, duration, iteration progress.
 */
export function MetricsDisplay({ metrics, isProcessing }: MetricsDisplayProps) {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>$0.0000</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>0s</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Loop 0/0</span>
          </div>
        </div>
        {isProcessing && (
          <>
            <div className="w-px h-4 bg-[var(--border)] mx-2" />
            <span className="text-xs text-blue-400 animate-pulse flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Processing...
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-6">
        {/* Current iteration cost */}
        <div className="flex items-center gap-2 text-green-400" title="Current iteration cost">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatCost(metrics.costUsd)}</span>
          {metrics.totalCostUsd > metrics.costUsd && (
            <span className="text-xs text-[var(--muted)]">
              (total: {formatCost(metrics.totalCostUsd)})
            </span>
          )}
        </div>

        {/* Current iteration duration */}
        <div className="flex items-center gap-2 text-blue-400" title="Current iteration duration">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatDuration(metrics.durationMs)}</span>
          {metrics.totalDurationMs > metrics.durationMs && (
            <span className="text-xs text-[var(--muted)]">
              (total: {formatDuration(metrics.totalDurationMs)})
            </span>
          )}
        </div>

        {/* Iteration counter */}
        <div className="flex items-center gap-2 text-yellow-400" title="Iteration progress">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Loop {metrics.iteration}/{metrics.maxIterations}</span>
        </div>
      </div>

      {isProcessing && (
        <>
          <div className="w-px h-4 bg-[var(--border)] mx-4" />
          <span className="text-xs text-blue-400 animate-pulse flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Processing...
          </span>
        </>
      )}
    </div>
  );
}

export default MetricsDisplay;
