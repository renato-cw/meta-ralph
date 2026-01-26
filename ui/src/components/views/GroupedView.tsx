'use client';

import { useMemo, useCallback } from 'react';
import { GroupHeader } from './GroupHeader';
import { IssueRow } from '@/components/IssueRow';
import type { Issue, GroupBy, SortState, SortField } from '@/lib/types';
import type { GroupedIssues } from '@/hooks/useGrouping';

/**
 * Extract repository full name from issue (supports both MultiRepoIssue and metadata).
 */
function getRepoFullName(issue: Issue): string | null {
  // Check for target_repo directly on extended issue (MultiRepoIssue)
  const extendedIssue = issue as Issue & { target_repo?: { fullName?: string; repo?: string } };
  if (extendedIssue.target_repo?.fullName) {
    return extendedIssue.target_repo.fullName;
  }
  if (extendedIssue.target_repo?.repo) {
    return extendedIssue.target_repo.repo;
  }
  // Check metadata for target_repo (fallback for normalized issues)
  if (issue.metadata?.target_repo) {
    const targetRepo = issue.metadata.target_repo as { fullName?: string; full_name?: string; repo?: string };
    return targetRepo.fullName || targetRepo.full_name || targetRepo.repo || null;
  }
  return null;
}

/**
 * Check if any issues have multi-repo target.
 */
function hasMultiRepoIssues(issues: Issue[]): boolean {
  return issues.some((issue) => getRepoFullName(issue) !== null);
}

interface GroupedViewProps {
  /** Grouped issues to display */
  groups: GroupedIssues[];
  /** Current groupBy field */
  groupBy: GroupBy;
  /** Set of selected issue IDs */
  selectedIds: Set<string>;
  /** Callback when an issue is toggled */
  onToggle: (id: string) => void;
  /** Callback when a row is clicked */
  onRowClick?: (issue: Issue) => void;
  /** Set of collapsed group keys */
  collapsedGroups: Set<string>;
  /** Callback when a group is toggled */
  onToggleGroup: (key: string) => void;
  /** Current sort state */
  sort: SortState;
  /** Callback when sort changes */
  onSort: (field: SortField) => void;
  /** Whether data is loading */
  loading?: boolean;
}

/**
 * Sortable column header component for grouped view tables.
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
        <span
          className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
        >
          {direction === 'asc' ? '\u2191' : direction === 'desc' ? '\u2193' : '\u2195'}
        </span>
      </div>
    </th>
  );
}

/**
 * Container component for displaying issues in grouped sections.
 *
 * Features:
 * - Collapsible group headers with counts
 * - Maintains sorting within each group
 * - Shows selected count per group
 * - Keyboard accessible
 */
export function GroupedView({
  groups,
  groupBy,
  selectedIds,
  onToggle,
  onRowClick,
  collapsedGroups,
  onToggleGroup,
  sort,
  onSort,
  loading = false,
}: GroupedViewProps) {
  // Calculate selected count per group
  const groupSelectedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groups) {
      const count = group.issues.filter((issue) => selectedIds.has(issue.id)).length;
      counts.set(group.key, count);
    }
    return counts;
  }, [groups, selectedIds]);

  // Determine if we should show the repo column (only when multi-repo issues exist)
  const showRepoColumn = useMemo(() => {
    const allIssues = groups.flatMap((g) => g.issues);
    return hasMultiRepoIssues(allIssues);
  }, [groups]);

  const isCollapsed = useCallback(
    (key: string) => collapsedGroups.has(key),
    [collapsedGroups]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary)]"></div>
        <span className="ml-3 text-[var(--muted)]">Loading issues...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted)]">No issues found.</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Make sure your providers are configured correctly.
        </p>
      </div>
    );
  }

  // If not grouped (groupBy is null), render single table
  if (!groupBy && groups.length === 1) {
    const group = groups[0];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="p-3 w-10">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3 w-12 text-[var(--muted)]">#</th>
              <SortableHeader field="provider" label="Provider" currentSort={sort} onSort={onSort} />
              {showRepoColumn && (
                <SortableHeader field="repo" label="Repo" currentSort={sort} onSort={onSort} />
              )}
              <SortableHeader field="priority" label="Priority" currentSort={sort} onSort={onSort} />
              <SortableHeader
                field="severity"
                label="Severity"
                currentSort={sort}
                onSort={onSort}
              />
              <SortableHeader
                field="count"
                label="Count"
                currentSort={sort}
                onSort={onSort}
                className="text-center"
              />
              <SortableHeader field="title" label="Title" currentSort={sort} onSort={onSort} />
              <th className="p-3 text-[var(--muted)]">Link</th>
            </tr>
          </thead>
          <tbody>
            {group.issues.map((issue, index) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                index={index}
                selected={selectedIds.has(issue.id)}
                onToggle={onToggle}
                onRowClick={onRowClick}
                showRepoColumn={showRepoColumn}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div data-testid="grouped-view" className="space-y-4">
      {groups.map((group, groupIndex) => {
        const collapsed = isCollapsed(group.key);
        const selectedCount = groupSelectedCounts.get(group.key) || 0;

        return (
          <div key={group.key} className="group-section">
            {/* Group Header */}
            <GroupHeader
              groupKey={group.key}
              label={group.label}
              count={group.count}
              isCollapsed={collapsed}
              onToggle={onToggleGroup}
              groupBy={groupBy}
              selectedCount={selectedCount}
            />

            {/* Group Content */}
            {!collapsed && (
              <div
                id={`group-content-${group.key}`}
                className="mt-2 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden"
              >
                <table className="w-full text-sm">
                  {/* Only show header for first group */}
                  {groupIndex === 0 && (
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left">
                        <th className="p-3 w-10">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="p-3 w-12 text-[var(--muted)]">#</th>
                        {groupBy !== 'provider' && (
                          <SortableHeader
                            field="provider"
                            label="Provider"
                            currentSort={sort}
                            onSort={onSort}
                          />
                        )}
                        {showRepoColumn && (
                          <SortableHeader
                            field="repo"
                            label="Repo"
                            currentSort={sort}
                            onSort={onSort}
                          />
                        )}
                        <SortableHeader
                          field="priority"
                          label="Priority"
                          currentSort={sort}
                          onSort={onSort}
                        />
                        {groupBy !== 'severity' && (
                          <SortableHeader
                            field="severity"
                            label="Severity"
                            currentSort={sort}
                            onSort={onSort}
                          />
                        )}
                        <SortableHeader
                          field="count"
                          label="Count"
                          currentSort={sort}
                          onSort={onSort}
                          className="text-center"
                        />
                        <SortableHeader
                          field="title"
                          label="Title"
                          currentSort={sort}
                          onSort={onSort}
                        />
                        <th className="p-3 text-[var(--muted)]">Link</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {group.issues.map((issue, index) => (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        index={index}
                        selected={selectedIds.has(issue.id)}
                        onToggle={onToggle}
                        onRowClick={onRowClick}
                        hideProvider={groupBy === 'provider'}
                        hideSeverity={groupBy === 'severity'}
                        showRepoColumn={showRepoColumn}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default GroupedView;
