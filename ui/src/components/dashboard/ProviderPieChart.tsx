'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PROVIDER_NAMES } from '@/lib/types';

interface ProviderPieChartProps {
  /** Data mapping provider name to issue count */
  data: Record<string, number>;
  /** Whether chart is loading */
  loading?: boolean;
}

// Colors for different providers
const PROVIDER_COLORS: Record<string, string> = {
  zeropath: '#3b82f6', // blue
  sentry: '#f97316',   // orange
  codecov: '#22c55e',  // green
  github: '#8b5cf6',   // purple
  jira: '#14b8a6',     // teal
  linear: '#ec4899',   // pink
};

const DEFAULT_COLOR = '#6b7280'; // gray

/**
 * ProviderPieChart displays a pie chart showing the distribution of issues by provider.
 * Used in the dashboard to visualize provider breakdown.
 */
export function ProviderPieChart({ data, loading = false }: ProviderPieChartProps) {
  if (loading) {
    return (
      <div
        className="h-[200px] flex items-center justify-center bg-zinc-800/50 rounded-lg animate-pulse"
        data-testid="provider-pie-chart-loading"
      >
        <div className="w-32 h-32 rounded-full bg-zinc-700" />
      </div>
    );
  }

  // Convert data to recharts format
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([provider, count]) => ({
      name: PROVIDER_NAMES[provider] || provider,
      value: count,
      provider,
    }));

  if (chartData.length === 0) {
    return (
      <div
        className="h-[200px] flex items-center justify-center text-zinc-500"
        data-testid="provider-pie-chart-empty"
      >
        No data available
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="h-[200px]" data-testid="provider-pie-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.provider}`}
                fill={PROVIDER_COLORS[entry.provider] || DEFAULT_COLOR}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fafafa',
            }}
            formatter={(value: number) => [
              `${value} (${((value / total) * 100).toFixed(1)}%)`,
              'Issues',
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-zinc-300 text-sm">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProviderPieChart;
