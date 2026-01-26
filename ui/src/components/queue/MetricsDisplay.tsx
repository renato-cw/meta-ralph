'use client';

import { ExecutionMetrics } from '@/lib/types';

/**
 * Props for the MetricsDisplay component.
 */
export interface MetricsDisplayProps {
  metrics: ExecutionMetrics | null;
  isProcessing?: boolean;
}

/**
 * Format cost as USD currency.
 */
function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * MetricsDisplay shows execution metrics during processing.
 * Displays iteration count, cost, and duration information.
 */
export function MetricsDisplay({ metrics, isProcessing = false }: MetricsDisplayProps) {
  // Show placeholder when no metrics
  if (!metrics) {
    return (
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700"
        data-testid="metrics-display"
      >
        <span className="text-sm text-gray-500">
          {isProcessing ? 'Waiting for metrics...' : 'No processing data'}
        </span>
      </div>
    );
  }

  const { iteration, maxIterations, costUsd, durationMs, totalCostUsd, totalDurationMs } = metrics;

  // Calculate progress percentage
  const progressPercent = Math.min(100, (iteration / maxIterations) * 100);

  return (
    <div
      className="px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3"
      data-testid="metrics-display"
    >
      {/* Iteration Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span className="text-sm font-medium text-gray-200">
            Loop {iteration} of {maxIterations}
          </span>
          {isProcessing && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              running
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">{progressPercent.toFixed(0)}%</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isProcessing ? 'bg-blue-500' : 'bg-green-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Current Iteration Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Cost:</span>
            <span className="text-green-400 font-mono">{formatCost(costUsd)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Duration:</span>
            <span className="text-blue-400 font-mono">{formatDuration(durationMs)}</span>
          </div>
        </div>
      </div>

      {/* Session Totals */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
        <span className="text-xs text-gray-500">Session Total</span>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-400 font-mono">{formatCost(totalCostUsd)}</span>
          <span className="text-blue-400 font-mono">{formatDuration(totalDurationMs)}</span>
        </div>
      </div>
    </div>
  );
}
