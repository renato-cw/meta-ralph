'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Severity } from '@/lib/types';

interface SeverityBarChartProps {
  /** Data mapping severity to issue count */
  data: Record<Severity, number>;
  /** Whether chart is loading */
  loading?: boolean;
}

// Colors for different severities
const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#ef4444', // red
  HIGH: '#f97316',     // orange
  MEDIUM: '#eab308',   // yellow
  LOW: '#22c55e',      // green
  INFO: '#3b82f6',     // blue
};

// Order for display
const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

/**
 * SeverityBarChart displays a horizontal bar chart showing issues by severity.
 * Used in the dashboard to visualize severity distribution.
 */
export function SeverityBarChart({ data, loading = false }: SeverityBarChartProps) {
  if (loading) {
    return (
      <div
        className="h-[200px] flex flex-col justify-center gap-2 bg-zinc-800/50 rounded-lg animate-pulse p-4"
        data-testid="severity-bar-chart-loading"
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-16 h-4 bg-zinc-700 rounded" />
            <div className="flex-1 h-4 bg-zinc-700 rounded" style={{ width: `${(5 - i) * 15}%` }} />
          </div>
        ))}
      </div>
    );
  }

  // Convert data to recharts format
  const chartData = SEVERITY_ORDER.map((severity) => ({
    name: severity,
    count: data[severity] || 0,
    fill: SEVERITY_COLORS[severity],
  }));

  const hasData = chartData.some((item) => item.count > 0);

  if (!hasData) {
    return (
      <div
        className="h-[200px] flex items-center justify-center text-zinc-500"
        data-testid="severity-bar-chart-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div className="h-[200px]" data-testid="severity-bar-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fafafa',
            }}
            formatter={(value: number) => [`${value} issues`, 'Count']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SeverityBarChart;
