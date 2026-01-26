'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { Issue, ProcessingStatus, Activity, ExecutionMetrics, ProcessingOptions } from '@/lib/types';
import { QueueProgress } from './QueueProgress';
import { ActivityFeed } from './ActivityFeed';
import { MetricsDisplay } from './MetricsDisplay';
import { PlanViewerModal } from './PlanViewerModal';
import { CIStatusPanel } from './CIStatusPanel';
import { ProviderBadge } from '../common/ProviderBadge';
import { useProcessingStream, useCIStatus } from '@/hooks';

interface ProcessingViewProps {
  isOpen: boolean;
  onClose: () => void;
  processing: ProcessingStatus;
  issues: Issue[];
  queuedIds: string[];
  logs: string[];
  processingOptions?: ProcessingOptions;
  onRetryItem: (id: string) => void;
  onRemoveItem?: (id: string) => void;
  onCancelAll?: () => void;
  /** Callback to execute build mode after plan completes */
  onExecuteBuild?: (issueIds: string[]) => void;
}

/**
 * Full-screen dedicated view for processing issues.
 * Replaces the cramped sidebar with a spacious layout.
 * Integrates with SSE streaming for real-time activity updates.
 */
export function ProcessingView({
  isOpen,
  onClose,
  processing,
  issues,
  queuedIds,
  logs: _logs,
  processingOptions,
  onRetryItem,
  onRemoveItem,
  onCancelAll,
  onExecuteBuild,
}: ProcessingViewProps) {
  // SSE streaming hook - connects to stream when processing
  const {
    activities: activitiesMap,
    metrics: metricsMap,
    connectionState,
    error: streamError,
  } = useProcessingStream({
    issueIds: queuedIds,
    autoConnect: isOpen && queuedIds.length > 0,
  });

  // State for plan viewer modal
  const [planViewerOpen, setPlanViewerOpen] = useState(false);
  const [selectedPlanIssueId, setSelectedPlanIssueId] = useState<string | null>(null);

  // CI status tracking
  const [ciInfo, setCiInfo] = useState<{
    sha: string;
    owner: string;
    repo: string;
  } | null>(null);
  const [showCIPanel, setShowCIPanel] = useState(false);

  // CI status hook - only active when we have commit info and CI awareness is enabled
  const ciEnabled = processingOptions?.ciAwareness ?? false;
  const {
    status: ciStatus,
    isPolling: ciIsPolling,
    isLoading: ciIsLoading,
    error: ciError,
    refresh: ciRefresh,
    triggerAutoFix: ciTriggerAutoFix,
    startPolling: ciStartPolling,
    stopPolling: _ciStopPolling,
  } = useCIStatus({
    owner: ciInfo?.owner ?? '',
    repo: ciInfo?.repo ?? '',
    sha: ciInfo?.sha ?? '',
    config: {
      enabled: ciEnabled && !!ciInfo,
      autoFix: processingOptions?.autoFixCi ?? false,
      pollInterval: 30000, // 30 seconds
      maxRetries: 3,
    },
    onSuccess: (response) => {
      console.log('CI checks passed:', response);
    },
    onFailure: (response, failures) => {
      console.log('CI checks failed:', failures);
      // Auto-expand CI panel on failure
      setShowCIPanel(true);
    },
  });

  // Determine if plan mode actions should be shown
  const isPlanMode = processingOptions?.mode === 'plan';
  const planCompleted = isPlanMode && processing.completed.length > 0 && !processing.isProcessing;

  // Get the first completed issue for plan viewing
  const firstCompletedIssue = processing.completed.length > 0
    ? issues.find(i => i.id === processing.completed[0])
    : null;

  // Hooks must be called before any early returns
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Aggregate activities from all issues into a single sorted array
  const allActivities = useMemo((): Activity[] => {
    const activities: Activity[] = [];
    activitiesMap.forEach((issueActivities) => {
      activities.push(...issueActivities);
    });
    // Sort by timestamp, most recent last (for bottom-to-top display)
    return activities.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [activitiesMap]);

  // Watch for push events in activities to extract CI info
  useEffect(() => {
    if (!ciEnabled) return;

    // Look for push activities that contain commit info
    for (const activity of allActivities) {
      if (activity.type === 'push' && activity.details) {
        // Try to extract commit SHA and repo info from activity details
        // Format expected: "Pushed to branch feature/xxx (sha: abc123)"
        const shaMatch = activity.details.match(/sha:\s*([a-f0-9]+)/i);
        const repoMatch = activity.details.match(/repo:\s*([^/\s]+\/[^/\s]+)/i);

        if (shaMatch) {
          const sha = shaMatch[1];
          // Try to get owner/repo from environment or activity
          const ownerRepo = repoMatch?.[1]?.split('/') ?? ['', ''];
          const owner = ownerRepo[0] || process.env.NEXT_PUBLIC_GITHUB_OWNER || 'unknown';
          const repo = ownerRepo[1] || process.env.NEXT_PUBLIC_GITHUB_REPO || 'unknown';

          if (sha !== ciInfo?.sha) {
            setCiInfo({ sha, owner, repo });
            setShowCIPanel(true);
            ciStartPolling();
          }
        }
      }
    }
  }, [allActivities, ciEnabled, ciInfo?.sha, ciStartPolling]);

  // Get the current metrics for the processing issue (or aggregate)
  const currentMetrics = useMemo((): ExecutionMetrics | null => {
    // If there's a current issue being processed, show its metrics
    if (processing.currentIssueId) {
      return metricsMap.get(processing.currentIssueId) || null;
    }
    // Otherwise, aggregate metrics from all issues
    if (metricsMap.size === 0) return null;

    let totalCost = 0;
    let totalDuration = 0;
    let maxIteration = 0;
    let maxIterations = 10;

    metricsMap.forEach((m) => {
      totalCost += m.totalCostUsd || m.costUsd || 0;
      totalDuration += m.totalDurationMs || m.durationMs || 0;
      if (m.iteration > maxIteration) maxIteration = m.iteration;
      if (m.maxIterations > maxIterations) maxIterations = m.maxIterations;
    });

    return {
      iteration: maxIteration,
      maxIterations,
      costUsd: 0,
      durationMs: 0,
      totalCostUsd: totalCost,
      totalDurationMs: totalDuration,
    };
  }, [metricsMap, processing.currentIssueId]);

  // Early return after hooks
  if (!isOpen) return null;

  // Get issue details for each queued ID
  const queueItems = queuedIds.map(id => {
    const issue = issues.find(i => i.id === id);
    let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';

    if (processing.currentIssueId === id) {
      status = 'processing';
    } else if (processing.completed.includes(id)) {
      status = 'completed';
    } else if (processing.failed.includes(id)) {
      status = 'failed';
    }

    return { id, issue, status };
  });

  // Categorize items
  const processingItems = queueItems.filter(i => i.status === 'processing');
  const pendingItems = queueItems.filter(i => i.status === 'pending');
  const completedItems = queueItems.filter(i => i.status === 'completed');
  const failedItems = queueItems.filter(i => i.status === 'failed');

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Issues</span>
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {processing.isProcessing && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
            Processing View
          </h1>
          {/* Mode Badge (Plan/Build) */}
          {processingOptions && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                processingOptions.mode === 'plan'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
              title={processingOptions.mode === 'plan' ? 'Plan mode: Analysis only' : 'Build mode: Implement fix'}
            >
              {processingOptions.mode === 'plan' ? '📋' : '🔨'}
              {processingOptions.mode === 'plan' ? 'Plan' : 'Build'}
            </span>
          )}
          {/* Model Badge (Sonnet/Opus) */}
          {processingOptions && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                processingOptions.model === 'opus'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
              title={processingOptions.model === 'opus' ? 'Opus: Most capable' : 'Sonnet: Fast & efficient'}
            >
              {processingOptions.model === 'opus' ? '🧠' : '⚡'}
              {processingOptions.model === 'opus' ? 'Opus' : 'Sonnet'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Plan Mode Actions */}
          {planCompleted && (
            <>
              <button
                onClick={() => {
                  setSelectedPlanIssueId(processing.completed[0] || null);
                  setPlanViewerOpen(true);
                }}
                className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2"
              >
                <span>📋</span>
                View Plan
              </button>
              {onExecuteBuild && (
                <button
                  onClick={() => onExecuteBuild(processing.completed)}
                  className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2"
                >
                  <span>🔨</span>
                  Execute Build
                </button>
              )}
            </>
          )}
          {pendingItems.length > 0 && onCancelAll && (
            <button
              onClick={onCancelAll}
              className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel Pending ({pendingItems.length})
            </button>
          )}
          <span className="text-sm text-[var(--muted)]">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded">ESC</kbd> to close
          </span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <QueueProgress
          total={queuedIds.length}
          completed={processing.completed.length}
          failed={processing.failed.length}
          processing={processing.currentIssueId ? 1 : 0}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel - Issue Queue */}
        <div className="w-1/3 border-r border-[var(--border)] flex flex-col bg-[var(--card)]">
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-medium text-[var(--foreground)]">Issue Queue</h2>
            <p className="text-xs text-[var(--muted)]">
              {queuedIds.length} issues · {completedItems.length} done · {failedItems.length} failed
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Processing */}
            {processingItems.map(({ id, issue, status }) => (
              <QueueItemCard
                key={id}
                id={id}
                issue={issue}
                status={status}
                onRetry={onRetryItem}
              />
            ))}

            {/* Pending */}
            {pendingItems.map(({ id, issue, status }) => (
              <QueueItemCard
                key={id}
                id={id}
                issue={issue}
                status={status}
                onRetry={onRetryItem}
                onRemove={onRemoveItem}
              />
            ))}

            {/* Completed */}
            {completedItems.length > 0 && (
              <div className="pt-2">
                <div className="text-xs text-green-400 font-medium px-2 py-1">
                  Completed ({completedItems.length})
                </div>
                {completedItems.map(({ id, issue, status }) => (
                  <QueueItemCard
                    key={id}
                    id={id}
                    issue={issue}
                    status={status}
                    onRetry={onRetryItem}
                  />
                ))}
              </div>
            )}

            {/* Failed */}
            {failedItems.length > 0 && (
              <div className="pt-2">
                <div className="text-xs text-red-400 font-medium px-2 py-1">
                  Failed ({failedItems.length})
                </div>
                {failedItems.map(({ id, issue, status }) => (
                  <QueueItemCard
                    key={id}
                    id={id}
                    issue={issue}
                    status={status}
                    onRetry={onRetryItem}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Activity Feed and CI Status */}
        <div className="flex-1 flex flex-col bg-[var(--background)]">
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="font-medium text-[var(--foreground)]">Activity Feed</h2>
              <p className="text-xs text-[var(--muted)]">
                Real-time actions from Claude
              </p>
            </div>
            <div className="flex items-center gap-2">
              {processing.isProcessing && (
                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full animate-pulse">
                  Live
                </span>
              )}
              {/* CI Status Toggle Button */}
              {ciEnabled && ciInfo && (
                <button
                  onClick={() => setShowCIPanel(!showCIPanel)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                    showCIPanel
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-[var(--muted)]/20 text-[var(--muted)] hover:bg-cyan-500/20 hover:text-cyan-400'
                  }`}
                  title={showCIPanel ? 'Hide CI status' : 'Show CI status'}
                >
                  <span>🔄</span>
                  <span>CI</span>
                  {ciStatus?.overallStatus === 'failure' && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  {ciStatus?.overallStatus === 'success' && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* CI Status Panel (collapsible) */}
          {ciEnabled && showCIPanel && ciInfo && (
            <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--card)]">
              <CIStatusPanel
                status={ciStatus}
                isLoading={ciIsLoading}
                error={ciError}
                isPolling={ciIsPolling}
                owner={ciInfo.owner}
                repo={ciInfo.repo}
                onRefresh={ciRefresh}
                onAutoFix={processingOptions?.autoFixCi ? ciTriggerAutoFix : undefined}
                showHeader={true}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <ActivityFeed
              activities={allActivities}
              metrics={currentMetrics}
              isProcessing={processing.isProcessing}
            />
          </div>

          {/* Connection status indicator */}
          {streamError && (
            <div className="flex-shrink-0 px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/30 text-yellow-400 text-sm">
              {streamError}
            </div>
          )}

          {/* Metrics bar at bottom */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center justify-between">
              <MetricsDisplay
                metrics={currentMetrics}
                isProcessing={processing.isProcessing}
              />
              {/* Connection state indicator */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-green-500'
                      : connectionState === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : connectionState === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-500'
                  }`}
                />
                <span className="text-[var(--muted)]">
                  {connectionState === 'connected'
                    ? 'Stream connected'
                    : connectionState === 'connecting'
                    ? 'Connecting...'
                    : connectionState === 'error'
                    ? 'Connection error'
                    : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Plan Viewer Modal */}
      <PlanViewerModal
        isOpen={planViewerOpen}
        onClose={() => {
          setPlanViewerOpen(false);
          setSelectedPlanIssueId(null);
        }}
        issueId={selectedPlanIssueId || ''}
        issueTitle={firstCompletedIssue?.title}
        onExecuteBuild={onExecuteBuild ? () => onExecuteBuild(processing.completed) : undefined}
      />
    </div>
  );
}

/**
 * Compact queue item card for the processing view.
 */
function QueueItemCard({
  id,
  issue,
  status,
  onRetry,
  onRemove,
}: {
  id: string;
  issue?: Issue;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  onRetry: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const statusStyles = {
    pending: 'border-[var(--border)] bg-[var(--background)]',
    processing: 'border-blue-500/50 bg-blue-500/10',
    completed: 'border-green-500/50 bg-green-500/10',
    failed: 'border-red-500/50 bg-red-500/10',
  };

  const statusIcons = {
    pending: (
      <div className="w-4 h-4 rounded-full border-2 border-[var(--muted)]" />
    ),
    processing: (
      <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ),
    completed: (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    failed: (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };

  return (
    <div className={`p-3 rounded-lg border ${statusStyles[status]} transition-all`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {statusIcons[status]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">
            {issue?.title || id}
          </p>
          {issue && (
            <div className="flex items-center gap-2 mt-1">
              <ProviderBadge provider={issue.provider} size="sm" />
              <span className="text-xs text-[var(--muted)]">
                Priority {issue.priority}
              </span>
            </div>
          )}
        </div>
        {status === 'failed' && (
          <button
            onClick={() => onRetry(id)}
            className="flex-shrink-0 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        )}
        {status === 'pending' && onRemove && (
          <button
            onClick={() => onRemove(id)}
            className="flex-shrink-0 px-2 py-1 text-xs bg-[var(--muted)]/20 text-[var(--muted)] rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
            title="Remove from queue"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
