'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { IssueTable } from '@/components/IssueTable';
import { ProcessButton } from '@/components/ProcessButton';
import { LogViewer } from '@/components/LogViewer';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterBar } from '@/components/filters/FilterBar';
import { BulkActionBar } from '@/components/actions/BulkActionBar';
import { IssueDetailPanel } from '@/components/details/IssueDetailPanel';
import { KeyboardShortcuts } from '@/components/common';
import { GroupedView, ViewToggle } from '@/components/views';
import { Dashboard } from '@/components/dashboard';
import { ProcessingQueue } from '@/components/queue';
import { useApp } from '@/contexts';
import type { SortField, GroupBy } from '@/lib/types';

export default function Home() {
  const {
    // Issues data
    issues,
    processedIssues,
    loading,
    error,
    setError,
    fetchIssues,
    availableProviders,

    // Selection state
    selectedIds,
    handleToggle,
    handleSelectAll,
    handleDeselectAll,

    // Detail panel state
    detailIssue,
    isDetailOpen,
    openDetailPanel,
    closeDetailPanel,

    // Processing state
    processing,
    processIssues,
    processSingleIssue,

    // Sort state
    sort,
    toggleSort,

    // Search state
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    submitSearch,
    searchScope,
    setSearchScope,
    searchHistory,
    selectFromHistory,
    removeFromHistory,

    // Filter state
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    hasActiveFilters,
    activeFilterCount,

    // Grouping state
    groupBy,
    setGroupBy,
    groupedIssues,
    collapsedGroups,
    toggleGroup,
    collapseAllGroups,
    expandAllGroups,
    collapsedCount,
  } = useApp();

  // Refs for keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter bar expanded state
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Queue panel state
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);

  const handleSort = useCallback((field: SortField) => {
    toggleSort(field);
  }, [toggleSort]);

  const handleProcess = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setQueuedIds(ids);
    setIsQueueOpen(true);
    await processIssues(ids);
  }, [selectedIds, processIssues]);

  const handleToggleQueue = useCallback(() => {
    setIsQueueOpen(prev => !prev);
  }, []);

  const handleCloseQueue = useCallback(() => {
    setIsQueueOpen(false);
  }, []);

  const handleRetryItem = useCallback(async (id: string) => {
    setQueuedIds(prev => [...prev, id]);
    await processIssues([id]);
  }, [processIssues]);

  const handleToggleFilters = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  const handleGroupByChange = useCallback((newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
  }, [setGroupBy]);

  const handleCollapseAll = useCallback(() => {
    collapseAllGroups(groupedIssues);
  }, [collapseAllGroups, groupedIssues]);

  return (
    <div>
      {/* Keyboard shortcuts handler */}
      <KeyboardShortcuts
        searchInputRef={searchInputRef}
        onToggleFilters={handleToggleFilters}
        onToggleQueue={handleToggleQueue}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Issue Queue</h2>
          <p className="text-[var(--muted)] text-sm mt-1">
            Select issues to process with Claude Code
            <span className="ml-2 text-xs opacity-60">
              (Press <kbd className="px-1 py-0.5 text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded">?</kbd> for shortcuts)
            </span>
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

      {/* Dashboard with statistics */}
      <Dashboard
        issues={issues}
        completedCount={processing.completed.length}
        failedCount={processing.failed.length}
        loading={loading}
      />

      {/* Search bar */}
      <div className="mb-4">
        <SearchBar
          ref={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={submitSearch}
          onClear={clearSearchQuery}
          scope={searchScope}
          onScopeChange={setSearchScope}
          history={searchHistory}
          onSelectHistory={selectFromHistory}
          onRemoveHistory={removeFromHistory}
          placeholder="Search issues by title, description, location, or ID... (Press / to focus)"
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
          expanded={filtersExpanded}
          onToggleExpanded={handleToggleFilters}
        />
      </div>

      {/* Results count and view toggle */}
      <div className="flex items-center justify-between mb-4">
        {(hasActiveFilters || searchQuery) ? (
          <div className="text-sm text-[var(--muted)]">
            Showing {processedIssues.length} of {issues.length} issues
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">
            {processedIssues.length} issues
          </div>
        )}
        <ViewToggle
          groupBy={groupBy}
          onGroupByChange={handleGroupByChange}
          hasCollapsedGroups={collapsedCount > 0}
          onCollapseAll={handleCollapseAll}
          onExpandAll={expandAllGroups}
          groupCount={groupedIssues.length}
          collapsedCount={collapsedCount}
        />
      </div>

      <div className="mb-20">
        {groupBy ? (
          /* Grouped view with collapsible sections */
          <GroupedView
            groups={groupedIssues}
            groupBy={groupBy}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onRowClick={openDetailPanel}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            sort={sort}
            onSort={handleSort}
            loading={loading}
          />
        ) : (
          /* Flat table view */
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <IssueTable
              issues={processedIssues}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              loading={loading}
              sort={sort}
              onSort={handleSort}
              onRowClick={openDetailPanel}
            />
          </div>
        )}
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
        onClose={closeDetailPanel}
        onProcess={processSingleIssue}
        isProcessing={processing.isProcessing}
      />

      {/* Processing queue panel */}
      <ProcessingQueue
        isOpen={isQueueOpen}
        onClose={handleCloseQueue}
        processing={processing}
        issues={issues}
        queuedIds={queuedIds}
        logs={processing.logs}
        onRetryItem={handleRetryItem}
      />
    </div>
  );
}
