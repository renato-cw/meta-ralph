'use client';

import type { CostEstimate } from '@/lib/types';

interface CostEstimateDisplayProps {
  estimate: CostEstimate;
  issueCount: number;
}

/**
 * Display component for showing estimated processing cost.
 */
export function CostEstimateDisplay({
  estimate,
  issueCount,
}: CostEstimateDisplayProps) {
  const formatCost = (value: number): string => {
    if (value < 0.01) return '<$0.01';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">💰</span>
        <span className="font-medium text-[var(--foreground)]">Estimated Cost</span>
      </div>
      <div className="text-2xl font-bold text-[var(--foreground)]">
        ~{formatCost(estimate.min)} - {formatCost(estimate.max)}
      </div>
      <div className="text-sm text-[var(--muted)] mt-1">
        for {issueCount} issue{issueCount !== 1 ? 's' : ''}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
        <div className="flex justify-between">
          <span>Average per issue:</span>
          <span>{formatCost(estimate.breakdown.perIssue)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Per iteration:</span>
          <span>{formatCost(estimate.breakdown.perIteration)}</span>
        </div>
      </div>
    </div>
  );
}
