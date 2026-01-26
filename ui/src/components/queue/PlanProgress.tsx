'use client';

import { useMemo } from 'react';
import type { PlanProgress as PlanProgressType } from '@/lib/types';

/**
 * Props for PlanProgress component.
 */
export interface PlanProgressProps {
  /** Progress statistics */
  progress: PlanProgressType;
  /** Whether to show compact view */
  compact?: boolean;
  /** Whether to show file progress */
  showFiles?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Get color classes based on progress percentage.
 */
function getProgressColors(percentage: number): {
  bar: string;
  text: string;
  bg: string;
} {
  if (percentage === 100) {
    return {
      bar: 'bg-green-500',
      text: 'text-green-400',
      bg: 'bg-green-900/30',
    };
  }
  if (percentage >= 70) {
    return {
      bar: 'bg-blue-500',
      text: 'text-blue-400',
      bg: 'bg-blue-900/30',
    };
  }
  if (percentage >= 30) {
    return {
      bar: 'bg-yellow-500',
      text: 'text-yellow-400',
      bg: 'bg-yellow-900/30',
    };
  }
  return {
    bar: 'bg-gray-500',
    text: 'text-gray-400',
    bg: 'bg-gray-900/30',
  };
}

/**
 * Generate progress bar visual using block characters.
 */
function generateProgressBar(percentage: number, width: number = 10): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Compact progress badge for inline display.
 */
function CompactProgress({
  progress,
  className = '',
}: {
  progress: PlanProgressType;
  className?: string;
}) {
  const colors = getProgressColors(progress.percentage);
  const totalItems = progress.totalSteps + progress.totalFiles;
  const completedItems = progress.completedSteps + progress.completedFiles;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${colors.bg} ${className}`}
      role="progressbar"
      aria-valuenow={progress.percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Plan progress: ${progress.percentage}% complete`}
    >
      <span className={`font-mono ${colors.text}`}>
        {generateProgressBar(progress.percentage, 8)}
      </span>
      <span className={colors.text}>
        {progress.percentage}% ({completedItems}/{totalItems})
      </span>
    </div>
  );
}

/**
 * Full progress display with steps and files breakdown.
 */
function FullProgress({
  progress,
  showFiles,
  className = '',
}: {
  progress: PlanProgressType;
  showFiles: boolean;
  className?: string;
}) {
  const colors = getProgressColors(progress.percentage);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Plan Progress</span>
          <span className={`font-medium ${colors.text}`}>
            {progress.percentage}%
          </span>
        </div>

        {/* Visual progress bar */}
        <div
          className="h-3 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Text representation */}
        <div className="text-xs text-gray-500 font-mono text-center">
          {generateProgressBar(progress.percentage, 20)} {progress.percentage}%
        </div>
      </div>

      {/* Steps breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="text-sm text-gray-400">Steps</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">
              {progress.completedSteps}
            </span>
            <span className="text-sm text-gray-500">
              / {progress.totalSteps}
            </span>
          </div>
          {progress.totalSteps > 0 && (
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} transition-all duration-300`}
                style={{
                  width: `${(progress.completedSteps / progress.totalSteps) * 100}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Files breakdown */}
        {showFiles && progress.totalFiles > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📁</span>
              <span className="text-sm text-gray-400">Files</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">
                {progress.completedFiles}
              </span>
              <span className="text-sm text-gray-500">
                / {progress.totalFiles}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} transition-all duration-300`}
                style={{
                  width: `${(progress.completedFiles / progress.totalFiles) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Display plan progress with visual indicators.
 * Shows completion percentage, steps completed, and files tracked.
 */
export function PlanProgress({
  progress,
  compact = false,
  showFiles = true,
  className = '',
}: PlanProgressProps) {
  // Validate progress data
  const isValid = useMemo(() => {
    return (
      progress &&
      typeof progress.percentage === 'number' &&
      typeof progress.totalSteps === 'number' &&
      typeof progress.completedSteps === 'number'
    );
  }, [progress]);

  if (!isValid) {
    return null;
  }

  if (compact) {
    return <CompactProgress progress={progress} className={className} />;
  }

  return (
    <FullProgress
      progress={progress}
      showFiles={showFiles}
      className={className}
    />
  );
}

export default PlanProgress;
