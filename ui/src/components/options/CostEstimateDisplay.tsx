'use client';

import { CostEstimate, ProcessingModel, MODEL_INFO } from '@/lib/types';

interface CostEstimateDisplayProps {
  estimate: CostEstimate;
  issueCount: number;
  model: ProcessingModel;
}

/**
 * Displays the estimated cost for processing issues.
 * Shows min/max range and cost breakdown information.
 */
export function CostEstimateDisplay({
  estimate,
  issueCount,
  model,
}: CostEstimateDisplayProps) {
  const formatCost = (value: number): string => {
    if (value < 0.01) return '<$0.01';
    if (value >= 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(2)}`;
  };

  const modelInfo = MODEL_INFO[model];
  const isHighCost = estimate.max > 5;
  const isOpusWarning = model === 'opus' && issueCount > 3;

  if (issueCount === 0) {
    return (
      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="text-sm text-[var(--color-text-secondary)]">
          Select issues to see cost estimate
        </div>
      </div>
    );
  }

  return (
    <div className={`
      p-4 rounded-lg border
      ${isHighCost || isOpusWarning
        ? 'bg-yellow-900/20 border-yellow-600/50'
        : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
      }
    `}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          Estimated Cost
        </span>
        <span className="text-lg font-mono font-semibold text-[var(--color-text-primary)]">
          {formatCost(estimate.min)} - {formatCost(estimate.max)}
        </span>
      </div>

      <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
        <div className="flex justify-between">
          <span>{issueCount} issue{issueCount > 1 ? 's' : ''}</span>
          <span>{modelInfo.name} @ ${modelInfo.costPer1kTokens.toFixed(3)}/1K tokens</span>
        </div>
      </div>

      {/* Warnings */}
      {(isHighCost || isOpusWarning) && (
        <div className="mt-3 pt-3 border-t border-yellow-600/30">
          {isHighCost && (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <span role="img" aria-label="warning">⚠️</span>
              High estimated cost. Consider using Sonnet or fewer iterations.
            </p>
          )}
          {isOpusWarning && !isHighCost && (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <span role="img" aria-label="info">💡</span>
              Opus is 5x more expensive than Sonnet. Consider if needed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
