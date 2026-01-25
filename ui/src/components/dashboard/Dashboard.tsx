'use client';

import { useState, useMemo } from 'react';
import { StatCard } from './StatCard';
import { ProviderPieChart } from './ProviderPieChart';
import { SeverityBarChart } from './SeverityBarChart';
import { PriorityHistogram } from './PriorityHistogram';
import { TopFilesTable } from './TopFilesTable';
import type { Issue, Severity, DashboardStats } from '@/lib/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface DashboardProps {
  /** All issues to calculate statistics from */
  issues: Issue[];
  /** Processing status for success rate calculation */
  completedCount?: number;
  failedCount?: number;
  /** Whether data is loading */
  loading?: boolean;
}

/**
 * Calculates statistics from an array of issues.
 */
function calculateStats(
  issues: Issue[],
  completedCount = 0,
  failedCount = 0
): DashboardStats {
  const byProvider: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  const byStatus: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    ignored: 0,
  };
  const priorityBuckets: Record<string, number> = {
    '0-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-80': 0,
    '81-100': 0,
  };
  const fileCount: Record<string, number> = {};

  for (const issue of issues) {
    // By provider
    byProvider[issue.provider] = (byProvider[issue.provider] || 0) + 1;

    // By severity
    if (issue.severity in bySeverity) {
      bySeverity[issue.severity]++;
    }

    // By priority range
    const priority = issue.priority;
    if (priority <= 20) priorityBuckets['0-20']++;
    else if (priority <= 40) priorityBuckets['21-40']++;
    else if (priority <= 60) priorityBuckets['41-60']++;
    else if (priority <= 80) priorityBuckets['61-80']++;
    else priorityBuckets['81-100']++;

    // By file location
    if (issue.location) {
      fileCount[issue.location] = (fileCount[issue.location] || 0) + 1;
    }
  }

  // Sort files by count and take top 5
  const topFilesByIssues = Object.entries(fileCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file, count]) => ({ file, count }));

  // Priority distribution in array format
  const priorityDistribution = [
    { range: '0-20', count: priorityBuckets['0-20'] },
    { range: '21-40', count: priorityBuckets['21-40'] },
    { range: '41-60', count: priorityBuckets['41-60'] },
    { range: '61-80', count: priorityBuckets['61-80'] },
    { range: '81-100', count: priorityBuckets['81-100'] },
  ];

  // Processing success rate
  const totalProcessed = completedCount + failedCount;
  const processingSuccessRate = totalProcessed > 0
    ? (completedCount / totalProcessed) * 100
    : 0;

  return {
    totalIssues: issues.length,
    byProvider,
    bySeverity,
    byStatus,
    priorityDistribution,
    processingSuccessRate,
    topFilesByIssues,
  };
}

/**
 * Dashboard displays aggregate statistics about issues in a collapsible section.
 * Shows metrics like total issues, distribution by provider/severity, and top files.
 */
export function Dashboard({
  issues,
  completedCount = 0,
  failedCount = 0,
  loading = false,
}: DashboardProps) {
  const [isExpanded, setIsExpanded] = useLocalStorage('dashboard-expanded', true);

  // Calculate stats from issues
  const stats = useMemo(
    () => calculateStats(issues, completedCount, failedCount),
    [issues, completedCount, failedCount]
  );

  // Count issues by severity for stat cards
  const criticalCount = stats.bySeverity.CRITICAL || 0;
  const highCount = stats.bySeverity.HIGH || 0;

  return (
    <div
      className="border border-zinc-700 rounded-lg bg-zinc-900/50 mb-4"
      data-testid="dashboard"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors rounded-t-lg"
        aria-expanded={isExpanded}
        aria-controls="dashboard-content"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="font-medium text-zinc-200">Dashboard</span>
          {!isExpanded && (
            <span className="text-sm text-zinc-500">
              ({stats.totalIssues} issues)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-900/50 text-red-300 rounded">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-900/50 text-orange-300 rounded">
              {highCount} High
            </span>
          )}
        </div>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          id="dashboard-content"
          className="p-4 border-t border-zinc-800"
        >
          {/* Stat cards row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Issues"
              value={stats.totalIssues}
              variant="default"
              loading={loading}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <StatCard
              title="Critical"
              value={criticalCount}
              variant="error"
              loading={loading}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
            <StatCard
              title="High Priority"
              value={highCount}
              variant="warning"
              loading={loading}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <StatCard
              title="Success Rate"
              value={`${stats.processingSuccessRate.toFixed(0)}%`}
              subtitle={`${completedCount} of ${completedCount + failedCount} processed`}
              variant={stats.processingSuccessRate >= 80 ? 'success' : stats.processingSuccessRate >= 50 ? 'warning' : 'error'}
              loading={loading}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Issues by Provider
              </h3>
              <ProviderPieChart data={stats.byProvider} loading={loading} />
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Issues by Severity
              </h3>
              <SeverityBarChart data={stats.bySeverity} loading={loading} />
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Priority Distribution
              </h3>
              <PriorityHistogram data={stats.priorityDistribution} loading={loading} />
            </div>
          </div>

          {/* Top files table */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Files by Issues
            </h3>
            <TopFilesTable data={stats.topFilesByIssues} loading={loading} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
