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

interface PriorityHistogramProps {
  /** Priority distribution data with range labels and counts */
  data: { range: string; count: number }[];
  /** Whether chart is loading */
  loading?: boolean;
}

// Color gradient from low (green) to high (red) priority
const PRIORITY_COLORS = [
  '#22c55e', // 0-20 (green - low priority)
  '#84cc16', // 21-40 (lime)
  '#eab308', // 41-60 (yellow)
  '#f97316', // 61-80 (orange)
  '#ef4444', // 81-100 (red - high priority)
];

/**
 * PriorityHistogram displays the distribution of issues across priority ranges.
 * Used in the dashboard to show how issues are distributed by priority score.
 */
export function PriorityHistogram({ data, loading = false }: PriorityHistogramProps) {
  if (loading) {
    // Stable heights for skeleton bars (avoiding Math.random during render)
    const skeletonHeights = [80, 120, 100, 140, 90];

    return (
      <div
        className="h-[200px] flex items-end justify-center gap-2 bg-zinc-800/50 rounded-lg animate-pulse p-4"
        data-testid="priority-histogram-loading"
      >
        {skeletonHeights.map((height, i) => (
          <div
            key={i}
            className="w-12 bg-zinc-700 rounded-t"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    );
  }

  // If no data provided, show default empty ranges
  const chartData = data.length > 0
    ? data.map((item, index) => ({
        ...item,
        fill: PRIORITY_COLORS[index] || PRIORITY_COLORS[PRIORITY_COLORS.length - 1],
      }))
    : [
        { range: '0-20', count: 0, fill: PRIORITY_COLORS[0] },
        { range: '21-40', count: 0, fill: PRIORITY_COLORS[1] },
        { range: '41-60', count: 0, fill: PRIORITY_COLORS[2] },
        { range: '61-80', count: 0, fill: PRIORITY_COLORS[3] },
        { range: '81-100', count: 0, fill: PRIORITY_COLORS[4] },
      ];

  const hasData = chartData.some((item) => item.count > 0);

  if (!hasData) {
    return (
      <div
        className="h-[200px] flex items-center justify-center text-zinc-500"
        data-testid="priority-histogram-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div className="h-[200px]" data-testid="priority-histogram">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="range"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={{ stroke: '#3f3f46' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#fafafa',
            }}
            formatter={(value: number) => [`${value} issues`, 'Count']}
            labelFormatter={(label) => `Priority: ${label}`}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PriorityHistogram;
