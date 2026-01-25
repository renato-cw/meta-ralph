'use client';

import { IssueRow } from './IssueRow';
import type { Issue, SortState, SortField, SortDirection, SEVERITY_ORDER } from '@/lib/types';

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
}: IssueTableProps) {
  const allSelected = issues.length > 0 && selectedIds.size === issues.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < issues.length;

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
    <div className="overflow-x-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <span className="text-sm text-[var(--muted)]">
          {selectedIds.size} of {issues.length} selected
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
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
        <tbody>
          {issues.map((issue, index) => (
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
    </div>
  );
}
