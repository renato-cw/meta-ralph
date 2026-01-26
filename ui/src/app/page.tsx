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
import { GroupedView, ViewToggle, SavedViews, SaveViewDialog } from '@/components/views';
import { Dashboard } from '@/components/dashboard';
import { ProcessingQueue, ProcessingView } from '@/components/queue';
import { HistoryView } from '@/components/history';
import { ProcessingOptionsPanel } from '@/components/options';
import { useSavedViews, useHistory } from '@/hooks';
import { useApp } from '@/contexts';
import type { SortField, GroupBy, SavedView, HistoryEntry, ProcessingOptions } from '@/lib/types';

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
  const [currentProcessingOptions, setCurrentProcessingOptions] = useState<ProcessingOptions | undefined>();

  // Save view dialog state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  // History panel state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Processing view state (full-screen dedicated view)
  const [isProcessingViewOpen, setIsProcessingViewOpen] = useState(false);

  // Processing options panel state
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  // History hook
  const {
    entries: historyEntries,
    filteredEntries: filteredHistoryEntries,
    filter: historyFilter,
    setFilter: setHistoryFilter,
    clearFilter: clearHistoryFilter,
    recordCompletion,
    recordFailure,
    removeEntry: removeHistoryEntry,
    clearHistory,
    clearFailed: clearFailedHistory,
    stats: historyStats,
  } = useHistory();

  // Saved views hook
  const handleLoadView = useCallback((view: SavedView) => {
    setFilters(view.filters);
    // Note: sort is managed by useSort hook via toggleSort, so we'd need to add a setSort function
    // For now, we'll apply the group by
    setGroupBy(view.groupBy);
  }, [setFilters, setGroupBy]);

  const {
    views: savedViews,
    activeView,
    saveView,
    deleteView,
    loadView,
    setDefaultView,
    renameView,
    duplicateView,
    matchesView,
  } = useSavedViews({
    currentFilters: filters,
    currentSort: sort,
    currentGroupBy: groupBy,
    onLoadView: handleLoadView,
  });

  const handleSort = useCallback((field: SortField) => {
    toggleSort(field);
  }, [toggleSort]);

  // Open options panel before processing
  const handleProcess = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsOptionsOpen(true);
  }, [selectedIds]);

  // Start processing with the selected options
  const handleStartProcessing = useCallback(async (options: ProcessingOptions) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setIsOptionsOpen(false);
    setQueuedIds(ids);
    setCurrentProcessingOptions(options); // Store options for display in queue
    setIsProcessingViewOpen(true); // Open full-screen processing view
    await processIssues(ids, options);
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

  const handleRemoveFromQueue = useCallback((id: string) => {
    setQueuedIds(prev => prev.filter(qid => qid !== id));
  }, []);

  const handleCancelAll = useCallback(() => {
    // Remove all pending items (keep completed and failed for history)
    setQueuedIds(prev => prev.filter(id =>
      processing.completed.includes(id) || processing.failed.includes(id)
    ));
  }, [processing.completed, processing.failed]);

  // Execute build mode after plan completes
  const handleExecuteBuild = useCallback(async (issueIds: string[]) => {
    if (issueIds.length === 0) return;
    // Create build options from current options but force mode to 'build'
    const buildOptions: ProcessingOptions = {
      ...(currentProcessingOptions || {
        mode: 'build',
        model: 'sonnet',
        maxIterations: 10,
        autoPush: true,
        ciAwareness: false,
        autoFixCi: false,
      }),
      mode: 'build', // Force build mode
    };
    setQueuedIds(issueIds);
    setCurrentProcessingOptions(buildOptions);
    await processIssues(issueIds, buildOptions);
  }, [currentProcessingOptions, processIssues]);

  const handleOpenProcessingView = useCallback(() => {
    setIsProcessingViewOpen(true);
  }, []);

  const handleCloseProcessingView = useCallback(() => {
    setIsProcessingViewOpen(false);
  }, []);

  const handleToggleFilters = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  const handleGroupByChange = useCallback((newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
  }, [setGroupBy]);

  const handleCollapseAll = useCallback(() => {
    collapseAllGroups(groupedIssues);
  }, [collapseAllGroups, groupedIssues]);

  const handleSaveViewClick = useCallback(() => {
    setIsSaveDialogOpen(true);
  }, []);

  const handleSaveView = useCallback((name: string) => {
    saveView(name);
  }, [saveView]);

  const handleToggleHistory = useCallback(() => {
    setIsHistoryOpen(prev => !prev);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
  }, []);

  const handleRetryFromHistory = useCallback(async (entry: HistoryEntry) => {
    // Find the issue and retry it
    const issue = issues.find(i => i.id === entry.issueId);
    if (issue) {
      setQueuedIds(prev => [...prev, issue.id]);
      setIsQueueOpen(true);
      await processIssues([issue.id]);
    }
  }, [issues, processIssues]);

  const handleRemoveFromHistory = useCallback((entry: HistoryEntry) => {
    removeHistoryEntry(entry.id);
  }, [removeHistoryEntry]);

  const hasUnsavedChanges = activeView ? !matchesView(activeView.id) : false;

  // Track processing completed/failed IDs to record history
  const previousCompletedRef = useRef<Set<string>>(new Set());
  const previousFailedRef = useRef<Set<string>>(new Set());

  // Record history when processing completes or fails
  useEffect(() => {
    // Check for newly completed
    const currentCompleted = new Set(processing.completed);
    for (const id of currentCompleted) {
      if (!previousCompletedRef.current.has(id)) {
        const issue = issues.find(i => i.id === id);
        if (issue) {
          recordCompletion(issue);
        }
      }
    }
    previousCompletedRef.current = currentCompleted;

    // Check for newly failed
    const currentFailed = new Set(processing.failed);
    for (const id of currentFailed) {
      if (!previousFailedRef.current.has(id)) {
        const issue = issues.find(i => i.id === id);
        if (issue) {
          recordFailure(issue, 'Processing failed');
        }
      }
    }
    previousFailedRef.current = currentFailed;
  }, [processing.completed, processing.failed, issues, recordCompletion, recordFailure]);

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
          {/* Processing View Button - shows when items are queued */}
          {queuedIds.length > 0 && (
            <button
              onClick={handleOpenProcessingView}
              className="px-4 py-2 text-sm border border-blue-500/50 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors flex items-center gap-2"
              title="Open processing view"
            >
              {processing.isProcessing && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Processing
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/30">
                {queuedIds.length}
              </span>
            </button>
          )}
          <button
            onClick={handleToggleHistory}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded hover:bg-[var(--card)] transition-colors flex items-center gap-2"
            title="View processing history"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
            {historyStats.total > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-white">
                {historyStats.total}
              </span>
            )}
          </button>
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

      {/* Results count, saved views, and view toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
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
          <SavedViews
            views={savedViews}
            activeView={activeView}
            onSelectView={loadView}
            onSaveClick={handleSaveViewClick}
            onDeleteView={deleteView}
            onSetDefault={setDefaultView}
            onRenameView={renameView}
            onDuplicateView={duplicateView}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
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
        processingOptions={currentProcessingOptions}
        onRetryItem={handleRetryItem}
      />

      {/* Save view dialog */}
      <SaveViewDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={handleSaveView}
        currentFilters={filters}
        currentSort={sort}
        currentGroupBy={groupBy}
      />

      {/* History panel */}
      <HistoryView
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        entries={historyEntries}
        filteredEntries={filteredHistoryEntries}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
        onClearFilter={clearHistoryFilter}
        onRetry={handleRetryFromHistory}
        onRemove={handleRemoveFromHistory}
        onClearHistory={clearHistory}
        onClearFailed={clearFailedHistory}
        stats={historyStats}
        availableProviders={availableProviders}
      />

      {/* Full-screen Processing View */}
      <ProcessingView
        isOpen={isProcessingViewOpen}
        onClose={handleCloseProcessingView}
        processing={processing}
        issues={issues}
        queuedIds={queuedIds}
        logs={processing.logs}
        processingOptions={currentProcessingOptions}
        onRetryItem={handleRetryItem}
        onRemoveItem={handleRemoveFromQueue}
        onCancelAll={handleCancelAll}
        onExecuteBuild={handleExecuteBuild}
      />

      {/* Processing Options Panel */}
      <ProcessingOptionsPanel
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        selectedIssues={processedIssues.filter((i) => selectedIds.has(i.id))}
        onStart={handleStartProcessing}
      />
    </div>
  );
}
