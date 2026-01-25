'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { IssueTable } from '@/components/IssueTable';
import { ProcessButton } from '@/components/ProcessButton';
import { LogViewer } from '@/components/LogViewer';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterBar } from '@/components/filters/FilterBar';
import { BulkActionBar } from '@/components/actions/BulkActionBar';
import { IssueDetailPanel } from '@/components/details/IssueDetailPanel';
import { useSort } from '@/hooks/useSort';
import { useSearch } from '@/hooks/useSearch';
import { useFilters } from '@/hooks/useFilters';
import type { Issue, ProcessingStatus, SortField } from '@/lib/types';

export default function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [processing, setProcessing] = useState<ProcessingStatus>({
    isProcessing: false,
    currentIssueId: null,
    logs: [],
    completed: [],
    failed: [],
  });

  // Use custom hooks for sort, search, and filters
  const { sort, toggleSort, sortIssues } = useSort();
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    clearQuery: clearSearchQuery,
    searchIssues,
    submitSearch,
    history: searchHistory,
    selectFromHistory,
    removeFromHistory,
    scope: searchScope,
    setScope: setSearchScope,
  } = useSearch();
  const {
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  } = useFilters({ syncUrl: true });

  // Get unique providers from issues
  const availableProviders = useMemo(
    () => [...new Set(issues.map((i) => i.provider))],
    [issues]
  );

  // Apply filters, search, and sort in sequence
  const processedIssues = useMemo(() => {
    let result = issues;
    result = filterIssues(result);
    result = searchIssues(result);
    result = sortIssues(result);
    return result;
  }, [issues, filterIssues, searchIssues, sortIssues]);

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
    // Select all currently visible (filtered) issues
    setSelectedIds(new Set(processedIssues.map((i) => i.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSort = useCallback((field: SortField) => {
    toggleSort(field);
  }, [toggleSort]);

  const handleRowClick = useCallback((issue: Issue) => {
    setDetailIssue(issue);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const handleProcessSingle = useCallback(async (issueId: string) => {
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [issueId] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start processing');
      }

      const data = await response.json();
      setProcessing(data.processing);
      setIsDetailOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
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

      {/* Search bar */}
      <div className="mb-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={submitSearch}
          onClear={clearSearchQuery}
          scope={searchScope}
          onScopeChange={setSearchScope}
          history={searchHistory}
          onSelectHistory={selectFromHistory}
          onRemoveHistory={removeFromHistory}
          placeholder="Search issues by title, description, location, or ID..."
        />
      </div>

      {/* Filter bar */}
      <div className="mb-4">
        <FilterBar
          filters={filters}
          availableProviders={availableProviders}
          onFilterChange={setFilters}
          onClearFilters={clearFilters}
          onToggleProvider={toggleProvider}
          onToggleSeverity={toggleSeverity}
          onToggleStatus={toggleStatus}
          onPriorityRangeChange={setPriorityRange}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Results count */}
      {(hasActiveFilters || searchQuery) && (
        <div className="mb-4 text-sm text-[var(--muted)]">
          Showing {processedIssues.length} of {issues.length} issues
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-20">
        <IssueTable
          issues={processedIssues}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          loading={loading}
          sort={sort}
          onSort={handleSort}
          onRowClick={handleRowClick}
        />
      </div>

      <LogViewer
        logs={processing.logs}
        isVisible={processing.isProcessing || processing.logs.length > 0}
      />

      {/* Bulk action bar - shows when items are selected */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        selectedIssues={processedIssues.filter((i) => selectedIds.has(i.id))}
        totalCount={processedIssues.length}
        isProcessing={processing.isProcessing}
        onProcess={handleProcess}
        onClearSelection={handleDeselectAll}
      />

      {/* Issue detail panel */}
      <IssueDetailPanel
        issue={detailIssue}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onProcess={handleProcessSingle}
        isProcessing={processing.isProcessing}
      />
    </div>
  );
}
