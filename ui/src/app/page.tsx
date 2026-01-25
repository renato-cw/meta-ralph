'use client';

import { useCallback, useRef, useState } from 'react';
import { IssueTable } from '@/components/IssueTable';
import { ProcessButton } from '@/components/ProcessButton';
import { LogViewer } from '@/components/LogViewer';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterBar } from '@/components/filters/FilterBar';
import { BulkActionBar } from '@/components/actions/BulkActionBar';
import { IssueDetailPanel } from '@/components/details/IssueDetailPanel';
import { KeyboardShortcuts } from '@/components/common';
import { useApp } from '@/contexts';
import type { SortField } from '@/lib/types';

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
  } = useApp();

  // Refs for keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter bar expanded state
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const handleSort = useCallback((field: SortField) => {
    toggleSort(field);
  }, [toggleSort]);

  const handleProcess = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await processIssues(Array.from(selectedIds));
  }, [selectedIds, processIssues]);

  const handleToggleFilters = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  return (
    <div>
      {/* Keyboard shortcuts handler */}
      <KeyboardShortcuts
        searchInputRef={searchInputRef}
        onToggleFilters={handleToggleFilters}
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
          onRowClick={openDetailPanel}
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
        onClose={closeDetailPanel}
        onProcess={processSingleIssue}
        isProcessing={processing.isProcessing}
      />
    </div>
  );
}
