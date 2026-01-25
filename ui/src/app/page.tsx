'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { IssueTable } from '@/components/IssueTable';
import { ProcessButton } from '@/components/ProcessButton';
import { LogViewer } from '@/components/LogViewer';
import type { Issue, ProcessingStatus, SortState, SortField, Severity, SEVERITY_ORDER } from '@/lib/types';

/**
 * Severity order for sorting (lower index = more severe).
 */
const SEVERITY_SORT_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/**
 * Get sort state from localStorage or return default.
 */
function getInitialSortState(): SortState {
  if (typeof window === 'undefined') {
    return { field: 'priority', direction: 'desc' };
  }
  try {
    const stored = localStorage.getItem('meta-ralph-sort');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore localStorage errors
  }
  return { field: 'priority', direction: 'desc' };
}

/**
 * Sort issues based on current sort state.
 */
function sortIssues(issues: Issue[], sort: SortState): Issue[] {
  const sorted = [...issues];
  const multiplier = sort.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'priority':
        return (a.priority - b.priority) * multiplier;
      case 'severity':
        return (SEVERITY_SORT_ORDER[a.severity] - SEVERITY_SORT_ORDER[b.severity]) * multiplier;
      case 'count':
        return (a.count - b.count) * multiplier;
      case 'title':
        return a.title.localeCompare(b.title) * multiplier;
      case 'provider':
        return a.provider.localeCompare(b.provider) * multiplier;
      case 'date':
        // Fall back to priority if date is not available
        return (a.priority - b.priority) * multiplier;
      default:
        return 0;
    }
  });

  return sorted;
}

export default function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(() => getInitialSortState());
  const [processing, setProcessing] = useState<ProcessingStatus>({
    isProcessing: false,
    currentIssueId: null,
    logs: [],
    completed: [],
    failed: [],
  });

  // Memoize sorted issues to avoid re-sorting on every render
  const sortedIssues = useMemo(() => sortIssues(issues, sort), [issues, sort]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues');
      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.statusText}`);
      }
      const data = await response.json();
      setIssues(data.issues || []);
      setProcessing(data.processing || processing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Poll for processing status when processing
  useEffect(() => {
    if (!processing.isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/issues');
        if (response.ok) {
          const data = await response.json();
          setProcessing(data.processing || processing);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [processing.isProcessing]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(issues.map((i) => i.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      const newSort: SortState = {
        field,
        // Toggle direction if same field, otherwise default to desc
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      };
      // Persist to localStorage
      try {
        localStorage.setItem('meta-ralph-sort', JSON.stringify(newSort));
      } catch {
        // Ignore localStorage errors
      }
      return newSort;
    });
  }, []);

  const handleProcess = async () => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start processing');
      }

      const data = await response.json();
      setProcessing(data.processing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Issue Queue</h2>
          <p className="text-[var(--muted)] text-sm mt-1">
            Select issues to process with Claude Code
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchIssues}
            disabled={loading}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded hover:bg-[var(--card)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <ProcessButton
            selectedCount={selectedIds.size}
            isProcessing={processing.isProcessing}
            onProcess={handleProcess}
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
        <IssueTable
          issues={sortedIssues}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          loading={loading}
          sort={sort}
          onSort={handleSort}
        />
      </div>

      <LogViewer
        logs={processing.logs}
        isVisible={processing.isProcessing || processing.logs.length > 0}
      />
    </div>
  );
}
