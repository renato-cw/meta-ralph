'use client';

import { type ReactNode } from 'react';

interface StatCardProps {
  /** Title/label for the stat */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Optional icon to display */
  icon?: ReactNode;
  /** Color variant for the card accent */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Optional trend indicator (positive or negative percentage) */
  trend?: number;
  /** Whether the card is in a loading state */
  loading?: boolean;
}

const variantStyles = {
  default: {
    border: 'border-zinc-700',
    accent: 'bg-zinc-600',
    text: 'text-zinc-300',
  },
  success: {
    border: 'border-green-800',
    accent: 'bg-green-600',
    text: 'text-green-400',
  },
  warning: {
    border: 'border-yellow-800',
    accent: 'bg-yellow-600',
    text: 'text-yellow-400',
  },
  error: {
    border: 'border-red-800',
    accent: 'bg-red-600',
    text: 'text-red-400',
  },
  info: {
    border: 'border-blue-800',
    accent: 'bg-blue-600',
    text: 'text-blue-400',
  },
};

/**
 * StatCard displays a single metric with optional icon, trend, and styling variants.
 * Used in the dashboard to show aggregate statistics about issues.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
  loading = false,
}: StatCardProps) {
  const styles = variantStyles[variant];

  if (loading) {
    return (
      <div
        className={`rounded-lg border ${styles.border} bg-zinc-800/50 p-4 animate-pulse`}
        data-testid="stat-card-loading"
      >
        <div className="h-4 w-24 bg-zinc-700 rounded mb-2" />
        <div className="h-8 w-16 bg-zinc-700 rounded mb-1" />
        <div className="h-3 w-20 bg-zinc-700 rounded" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border ${styles.border} bg-zinc-800/50 p-4 transition-all hover:bg-zinc-800`}
      data-testid="stat-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-400 mb-1">{title}</p>
          <p className={`text-2xl font-semibold ${styles.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${styles.accent}/20`}>
            <span className={styles.text}>{icon}</span>
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={`text-xs font-medium ${
              trend >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-500">vs. last period</span>
        </div>
      )}
    </div>
  );
}

export default StatCard;
