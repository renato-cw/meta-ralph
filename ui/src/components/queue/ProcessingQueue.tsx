'use client';

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import type { Issue, ProcessingStatus, Activity, ExecutionMetrics, CIStatus, CICheck } from '@/lib/types';
import { QueueItem } from './QueueItem';
import { QueueProgress } from './QueueProgress';
import { ActivityFeed } from './ActivityFeed';
import { CIStatusPanel } from './CIStatusPanel';
import { parseLogs } from '@/lib/events';
import { CIPollingState } from '@/hooks/useCIStatus';

/**
 * View mode for the processing output section.
 */
type OutputViewMode = 'activity' | 'logs';

interface ProcessingQueueProps {
  /** Whether the queue panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Current processing status */
  processing: ProcessingStatus;
  /** All issues (for looking up issue details) */
  issues: Issue[];
  /** IDs of issues that were queued for processing */
  queuedIds: string[];
  /** Processing logs */
  logs: string[];
  /** Whether the queue is paused (for future use) */
  isPaused?: boolean;
  /** Callback to toggle pause state (for future use) */
  onTogglePause?: () => void;
  /** Callback to cancel a pending item (for future use) */
  onCancelItem?: (id: string) => void;
  /** Callback to retry a failed item */
  onRetryItem?: (id: string) => void;
  /** Callback to clear completed/failed items */
  onClearCompleted?: () => void;
  /** Maximum iterations for metrics display */
  maxIterations?: number;
  /** CI/CD awareness props */
  ciStatus?: CIStatus | null;
  /** CI polling state */
  ciPollingState?: CIPollingState;
  /** CI error message */
  ciError?: string | null;
  /** Time until next CI poll */
  ciNextPollIn?: number;
  /** Number of CI polls made */
  ciPollCount?: number;
  /** Whether CI awareness is enabled */
  ciEnabled?: boolean;
  /** Whether auto-fix CI is enabled */
  autoFixCiEnabled?: boolean;
  /** Callback to refresh CI status */
  onCiRefresh?: () => void;
  /** Callback to trigger auto-fix */
  onCiAutoFix?: () => void;
  /** Callback when viewing CI check details */
  onCiViewDetails?: (check: CICheck) => void;
}

type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface QueueEntry {
  issue: Issue;
  status: QueueItemStatus;
  startedAt?: string;
  completedAt?: string;
  prUrl?: string;
  error?: string;
}

/**
 * Processing queue visualization sidebar.
 * Shows all queued items with their status and a progress indicator.
 */
export function ProcessingQueue({
  isOpen,
  onClose,
  processing,
  issues,
  queuedIds,
  logs,
  isPaused = false,
  onTogglePause,
  onCancelItem,
  onRetryItem,
  onClearCompleted,
  maxIterations = 10,
  ciStatus,
  ciPollingState = 'idle',
  ciError,
  ciNextPollIn = 0,
  ciPollCount = 0,
  ciEnabled = false,
  autoFixCiEnabled = false,
  onCiRefresh,
  onCiAutoFix,
  onCiViewDetails,
}: ProcessingQueueProps) {
  // Track when processing started for ETA calculation
  const [startedAt, setStartedAt] = useState<string | undefined>();
  // Output view mode (activity feed vs raw logs)
  const [outputViewMode, setOutputViewMode] = useState<OutputViewMode>('activity');
  // Track processed log indices to avoid duplicates
  const processedLogsIndexRef = useRef<number>(0);
  // Accumulated activities
  const [activities, setActivities] = useState<Activity[]>([]);
  // Current metrics
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);

  // Set start time when processing begins
  // This is a legitimate pattern to synchronize local state with external processing state
  useEffect(() => {
    if (processing.isProcessing && !startedAt) {
      setStartedAt(new Date().toISOString());
      // Reset activities and metrics when processing starts
      setActivities([]);
      setMetrics(null);
      processedLogsIndexRef.current = 0;
    } else if (!processing.isProcessing && startedAt) {
      // Reset start time when processing completes
      setStartedAt(undefined);
    }
  }, [processing.isProcessing, startedAt]);

  // Parse new logs into activities
  useEffect(() => {
    if (logs.length <= processedLogsIndexRef.current) return;

    const newLogs = logs.slice(processedLogsIndexRef.current);
    processedLogsIndexRef.current = logs.length;

    const { activities: newActivities, metrics: newMetrics } = parseLogs(newLogs, maxIterations);

    if (newActivities.length > 0) {
      setActivities(prev => {
        const combined = [...prev, ...newActivities];
        // Keep only last 500 activities
        return combined.length > 500 ? combined.slice(-500) : combined;
      });
    }

    if (newMetrics) {
      setMetrics(newMetrics);
    }
  }, [logs, maxIterations]);

  // Build queue entries from processing state and issues
  const queueEntries = useMemo((): QueueEntry[] => {
    const entries: QueueEntry[] = [];
    const issueMap = new Map(issues.map(i => [i.id, i]));

    // Get all issue IDs that should be in the queue
    const allIds = new Set([
      ...queuedIds,
      ...processing.completed,
      ...processing.failed,
      ...(processing.currentIssueId ? [processing.currentIssueId] : []),
    ]);

    allIds.forEach(id => {
      const issue = issueMap.get(id);
      if (!issue) return;

      let status: QueueItemStatus = 'pending';
      if (processing.completed.includes(id)) {
        status = 'completed';
      } else if (processing.failed.includes(id)) {
        status = 'failed';
      } else if (processing.currentIssueId === id) {
        status = 'processing';
      }

      entries.push({
        issue,
        status,
        startedAt: status === 'processing' ? startedAt : undefined,
        // These would come from a more detailed API response in the future
        prUrl: undefined,
        error: status === 'failed' ? 'Processing failed. Check logs for details.' : undefined,
      });
    });

    // Sort: processing first, then pending, then completed, then failed
    const statusOrder: Record<QueueItemStatus, number> = {
      processing: 0,
      pending: 1,
      completed: 2,
      failed: 3,
    };

    return entries.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [issues, queuedIds, processing, startedAt]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    const total = queueEntries.length;
    const completed = queueEntries.filter(e => e.status === 'completed').length;
    const failed = queueEntries.filter(e => e.status === 'failed').length;
    const processing = queueEntries.filter(e => e.status === 'processing').length;

    return { total, completed, failed, processing };
  }, [queueEntries]);

  // Filter entries by status for section rendering
  const processingEntries = queueEntries.filter(e => e.status === 'processing');
  const pendingEntries = queueEntries.filter(e => e.status === 'pending');
  const completedEntries = queueEntries.filter(e => e.status === 'completed');
  const failedEntries = queueEntries.filter(e => e.status === 'failed');

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const hasItems = queueEntries.length > 0;
  const hasCompletedOrFailed = completedEntries.length > 0 || failedEntries.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] shadow-xl z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-title"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-[var(--card)] border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 id="queue-title" className="text-lg font-semibold">
                Processing Queue
              </h2>
              {processing.isProcessing && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Pause/Resume button (for future API support) */}
              {onTogglePause && processing.isProcessing && (
                <button
                  onClick={onTogglePause}
                  className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
                  title={isPaused ? 'Resume processing' : 'Pause processing'}
                >
                  {isPaused ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              )}
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
                aria-label="Close queue panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar (when there are items) */}
        {hasItems && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)]">
            <QueueProgress
              total={progressStats.total}
              completed={progressStats.completed}
              failed={progressStats.failed}
              processing={progressStats.processing}
              startedAt={startedAt}
            />
          </div>
        )}

        {/* Queue content */}
        <div className="flex-1 overflow-y-auto">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] p-8">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-center">
                No items in queue.
                <br />
                <span className="text-sm">Select issues and click Process to start.</span>
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Processing section */}
              {processingEntries.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Processing ({processingEntries.length})
                  </h3>
                  <div className="space-y-2">
                    {processingEntries.map(entry => (
                      <QueueItem
                        key={entry.issue.id}
                        issue={entry.issue}
                        status={entry.status}
                        startedAt={entry.startedAt}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Pending section */}
              {pendingEntries.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Pending ({pendingEntries.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingEntries.map(entry => (
                      <QueueItem
                        key={entry.issue.id}
                        issue={entry.issue}
                        status={entry.status}
                        onCancel={onCancelItem ? () => onCancelItem(entry.issue.id) : undefined}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Completed section */}
              {completedEntries.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Completed ({completedEntries.length})
                  </h3>
                  <div className="space-y-2">
                    {completedEntries.map(entry => (
                      <QueueItem
                        key={entry.issue.id}
                        issue={entry.issue}
                        status={entry.status}
                        prUrl={entry.prUrl}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Failed section */}
              {failedEntries.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Failed ({failedEntries.length})
                  </h3>
                  <div className="space-y-2">
                    {failedEntries.map(entry => (
                      <QueueItem
                        key={entry.issue.id}
                        issue={entry.issue}
                        status={entry.status}
                        error={entry.error}
                        onRetry={onRetryItem ? () => onRetryItem(entry.issue.id) : undefined}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {hasCompletedOrFailed && onClearCompleted && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--border)]">
            <button
              onClick={onClearCompleted}
              className="w-full px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
            >
              Clear Completed & Failed
            </button>
          </div>
        )}

        {/* CI/CD Status Panel */}
        {ciEnabled && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-[var(--border)]">
            <CIStatusPanel
              status={ciStatus ?? null}
              pollingState={ciPollingState}
              error={ciError ?? null}
              nextPollIn={ciNextPollIn}
              pollCount={ciPollCount}
              isEnabled={ciEnabled}
              autoFixEnabled={autoFixCiEnabled}
              onRefresh={onCiRefresh ?? (() => {})}
              onAutoFix={onCiAutoFix}
              onViewDetails={onCiViewDetails}
            />
          </div>
        )}

        {/* Output section - Activity Feed or Logs */}
        {(processing.isProcessing || logs.length > 0) && (
          <OutputSection
            logs={logs}
            activities={activities}
            metrics={metrics}
            isProcessing={processing.isProcessing}
            viewMode={outputViewMode}
            onViewModeChange={setOutputViewMode}
          />
        )}
      </div>
    </>
  );
}

/**
 * Output section with toggle between Activity Feed and Raw Logs views.
 */
interface OutputSectionProps {
  logs: string[];
  activities: Activity[];
  metrics: ExecutionMetrics | null;
  isProcessing: boolean;
  viewMode: OutputViewMode;
  onViewModeChange: (mode: OutputViewMode) => void;
}

function OutputSection({
  logs,
  activities,
  metrics,
  isProcessing,
  viewMode,
  onViewModeChange,
}: OutputSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFullHeight, setIsFullHeight] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive (only in logs view)
  useEffect(() => {
    if (isExpanded && viewMode === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded, viewMode]);

  // Expand automatically when processing starts
  useEffect(() => {
    if (isProcessing) {
      setIsExpanded(true);
    }
  }, [isProcessing]);

  const contentHeight = isFullHeight ? 'h-96' : 'h-64';

  return (
    <div className={`flex-shrink-0 border-t border-[var(--border)] ${isExpanded ? 'flex flex-col' : ''}`}>
      {/* Header with view toggle */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--background)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="font-medium">Output</span>
          </button>

          {/* View mode toggle */}
          {isExpanded && (
            <div className="flex items-center bg-[var(--border)] rounded-lg p-0.5">
              <button
                onClick={() => onViewModeChange('activity')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'activity'
                    ? 'bg-[var(--card)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Activity
              </button>
              <button
                onClick={() => onViewModeChange('logs')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'logs'
                    ? 'bg-[var(--card)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Logs ({logs.length})
              </button>
            </div>
          )}

          {isProcessing && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              streaming
            </span>
          )}
        </div>

        {isExpanded && (
          <button
            onClick={() => setIsFullHeight(!isFullHeight)}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded transition-colors"
            title={isFullHeight ? 'Collapse' : 'Expand'}
          >
            {isFullHeight ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={`bg-[#0d1117] ${contentHeight} overflow-hidden transition-all duration-200`}>
          {viewMode === 'activity' ? (
            <div className="h-full p-3 overflow-y-auto">
              <ActivityFeed
                activities={activities}
                metrics={metrics}
                isProcessing={isProcessing}
                maxHeight={isFullHeight ? 'h-[calc(100%-1rem)]' : 'h-[calc(100%-1rem)]'}
              />
            </div>
          ) : (
            <div className="h-full overflow-y-auto font-mono text-xs">
              <div className="p-3 space-y-0.5">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic">Waiting for logs...</div>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={`whitespace-pre-wrap break-all leading-relaxed ${
                        log.includes('[error]') || log.includes('Error') || log.includes('ERROR')
                          ? 'text-red-400'
                          : log.includes('[stderr]') || log.includes('warning') || log.includes('WARN')
                          ? 'text-yellow-400'
                          : log.includes('success') || log.includes('complete') || log.includes('COMPLETE')
                          ? 'text-green-400'
                          : log.includes('>>>') || log.includes('===')
                          ? 'text-cyan-400 font-semibold'
                          : 'text-gray-400'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

