'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { IssueRow } from './IssueRow';
import { PageSizeSelector, LoadMoreButton } from './common';
import { useVirtualList } from '@/hooks/useVirtualList';
import type { Issue, SortState, SortField } from '@/lib/types';

/** Threshold for enabling virtualization (number of items) */
const VIRTUALIZATION_THRESHOLD = 100;

/** Estimated row height for virtualization */
const ROW_HEIGHT = 52;

interface IssueTableProps {
  issues: Issue[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  loading: boolean;
  sort: SortState;
  onSort: (field: SortField) => void;
  onRowClick?: (issue: Issue) => void;
  /** Enable pagination controls (default: true for large lists) */
  showPagination?: boolean;
}

/**
 * Sortable column header component with visual indicators.
 */
function SortableHeader({
  field,
  label,
  currentSort,
  onSort,
  className = '',
}: {
  field: SortField;
  label: string;
  currentSort: SortState;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort.field === field;
  const direction = isActive ? currentSort.direction : null;

  return (
    <th
      className={`p-3 text-[var(--muted)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors group ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
        </span>
      </div>
    </th>
  );
}

/**
 * Table header row component (reused across virtualized and non-virtualized modes).
 */
function TableHeader({
  sort,
  onSort,
  allSelected,
  someSelected,
  onSelectAll,
  onDeselectAll,
}: {
  sort: SortState;
  onSort: (field: SortField) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  return (
    <thead className="sticky top-0 bg-[var(--card)] z-10">
      <tr className="border-b border-[var(--border)] text-left">
        <th className="p-3 w-10">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={allSelected ? onDeselectAll : onSelectAll}
            className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] cursor-pointer"
          />
        </th>
        <th className="p-3 w-12 text-[var(--muted)]">#</th>
        <SortableHeader field="provider" label="Provider" currentSort={sort} onSort={onSort} />
        <SortableHeader field="priority" label="Priority" currentSort={sort} onSort={onSort} />
        <SortableHeader field="severity" label="Severity" currentSort={sort} onSort={onSort} />
        <SortableHeader field="count" label="Count" currentSort={sort} onSort={onSort} className="text-center" />
        <SortableHeader field="title" label="Title" currentSort={sort} onSort={onSort} />
        <th className="p-3 text-[var(--muted)]">Link</th>
      </tr>
    </thead>
  );
}

export function IssueTable({
  issues,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  loading,
  sort,
  onSort,
  onRowClick,
  showPagination,
}: IssueTableProps) {
  // Use virtual list hook for pagination and virtualization
  const {
    containerRef,
    isVirtualized,
    displayItems,
    pageSize,
    setPageSize,
    totalCount,
    displayCount,
    showingAll,
    loadMore,
    hasMore,
  } = useVirtualList({
    items: issues,
    estimatedRowHeight: ROW_HEIGHT,
    virtualizationThreshold: VIRTUALIZATION_THRESHOLD,
  });

  const allSelected = displayItems.length > 0 && selectedIds.size === displayItems.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < displayItems.length;

  // Determine if we should show pagination (default: show for 25+ items)
  const shouldShowPagination = showPagination !== undefined
    ? showPagination
    : issues.length >= 25;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary)]"></div>
        <span className="ml-3 text-[var(--muted)]">Loading issues...</span>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted)]">No issues found.</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Make sure your providers are configured correctly.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="issue-table">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-[var(--muted)]">
            {selectedIds.size} of {displayCount} selected
          </span>
        </div>

        {shouldShowPagination && (
          <PageSizeSelector
            value={pageSize}
            onChange={setPageSize}
            totalCount={totalCount}
            displayCount={displayCount}
            showingAll={showingAll}
          />
        )}
      </div>

      {isVirtualized ? (
        // Virtualized mode for large lists
        <VirtualizedTable
          containerRef={containerRef}
          issues={displayItems}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          sort={sort}
          onSort={onSort}
          onRowClick={onRowClick}
          allSelected={allSelected}
          someSelected={someSelected}
        />
      ) : (
        // Standard table for smaller lists
        <>
          <table className="w-full text-sm">
            <TableHeader
              sort={sort}
              onSort={onSort}
              allSelected={allSelected}
              someSelected={someSelected}
              onSelectAll={onSelectAll}
              onDeselectAll={onDeselectAll}
            />
            <tbody>
              {displayItems.map((issue, index) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  index={index}
                  selected={selectedIds.has(issue.id)}
                  onToggle={onToggle}
                  onRowClick={onRowClick}
                />
              ))}
            </tbody>
          </table>

          {hasMore && (
            <LoadMoreButton
              onClick={loadMore}
              loadedCount={displayCount}
              totalCount={totalCount}
              hasMore={hasMore}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Virtualized table component for large lists (100+ items).
 * Uses @tanstack/react-virtual for efficient rendering.
 */
function VirtualizedTable({
  containerRef,
  issues,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  sort,
  onSort,
  onRowClick,
  allSelected,
  someSelected,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  issues: Issue[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  sort: SortState;
  onSort: (field: SortField) => void;
  onRowClick?: (issue: Issue) => void;
  allSelected: boolean;
  someSelected: boolean;
}) {
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      className="max-h-[600px] overflow-auto"
      style={{ contain: 'strict' }}
    >
      <table className="w-full text-sm">
        <TableHeader
          sort={sort}
          onSort={onSort}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
        />
        <tbody
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const issue = issues[virtualItem.index];
            return (
              <tr
                key={issue.id}
                data-issue-index={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={`border-b border-[var(--border)] hover:bg-[var(--card)] cursor-pointer transition-colors ${
                  selectedIds.has(issue.id) ? 'bg-[var(--card)]' : ''
                }`}
                onClick={() => onRowClick ? onRowClick(issue) : onToggle(issue.id)}
              >
                <td className="p-3" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(issue.id)}
                    onChange={() => onToggle(issue.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] cursor-pointer"
                  />
                </td>
                <td className="p-3 text-[var(--muted)]" style={{ width: '48px' }}>
                  {virtualItem.index + 1}
                </td>
                <td className="p-3">
                  <span className="px-2 py-1 text-xs rounded bg-[var(--card)] text-[var(--foreground)]">
                    {issue.provider}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`font-mono font-bold ${getPriorityColor(issue.priority)}`}>
                    {issue.priority}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded badge-${issue.severity.toLowerCase()}`}>
                    {issue.severity}
                  </span>
                </td>
                <td className="p-3 text-center">{issue.count}</td>
                <td className="p-3 max-w-md truncate" title={issue.title}>
                  {issue.title}
                </td>
                <td className="p-3">
                  {issue.permalink && (
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--primary)] hover:text-[var(--primary-hover)] text-sm"
                    >
                      View
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getPriorityColor(priority: number): string {
  if (priority >= 90) return 'text-red-400';
  if (priority >= 70) return 'text-yellow-400';
  if (priority >= 40) return 'text-cyan-400';
  return 'text-green-400';
}
