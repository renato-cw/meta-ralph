'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { SortState, SortField, SortDirection, Issue, Severity } from '@/lib/types';
import { DEFAULT_SORT_STATE } from '@/lib/types';

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
 * Extract repository full name from issue (supports both MultiRepoIssue and metadata).
 */
function getRepoFullName(issue: Issue): string | null {
  // Check for target_repo directly on extended issue (MultiRepoIssue)
  const extendedIssue = issue as Issue & { target_repo?: { fullName?: string } };
  if (extendedIssue.target_repo?.fullName) {
    return extendedIssue.target_repo.fullName;
  }
  // Check metadata for target_repo (fallback for normalized issues)
  if (issue.metadata?.target_repo) {
    const targetRepo = issue.metadata.target_repo as { fullName?: string; full_name?: string };
    return targetRepo.fullName || targetRepo.full_name || null;
  }
  return null;
}

/**
 * Sort hook with localStorage persistence and URL param sync.
 *
 * @param storageKey - The localStorage key for persisting sort state
 * @returns Object with sort state, handlers, and sorted issues function
 *
 * @example
 * const { sort, setSort, toggleSort, sortIssues } = useSort('meta-ralph-sort');
 * const sortedIssues = sortIssues(issues);
 */
export function useSort(storageKey: string = 'meta-ralph-sort') {
  const [sort, setSort] = useLocalStorage<SortState>(storageKey, DEFAULT_SORT_STATE);

  /**
   * Toggle sort direction for a field.
   * If clicking a different field, defaults to descending.
   * If clicking the same field, toggles between desc -> asc -> desc.
   */
  const toggleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, [setSort]);

  /**
   * Set sort to specific field and direction.
   */
  const setSortField = useCallback((field: SortField, direction: SortDirection) => {
    setSort({ field, direction });
  }, [setSort]);

  /**
   * Reset sort to default state.
   */
  const resetSort = useCallback(() => {
    setSort(DEFAULT_SORT_STATE);
  }, [setSort]);

  /**
   * Sort issues based on current sort state.
   */
  const sortIssues = useCallback((issues: Issue[]): Issue[] => {
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
        case 'date': {
          // Date sorting will use metadata.firstSeen or metadata.lastSeen when available
          const aDate = (a.metadata?.firstSeen as string) || (a.metadata?.lastSeen as string) || '';
          const bDate = (b.metadata?.firstSeen as string) || (b.metadata?.lastSeen as string) || '';
          if (!aDate && !bDate) {
            // Fall back to priority if no dates
            return (a.priority - b.priority) * multiplier;
          }
          return aDate.localeCompare(bDate) * multiplier;
        }
        case 'repo': {
          // Repo sorting uses target_repo.fullName from metadata or extended issue
          const aRepo = getRepoFullName(a);
          const bRepo = getRepoFullName(b);
          // Issues without repo go to the end
          if (!aRepo && !bRepo) return 0;
          if (!aRepo) return 1;
          if (!bRepo) return -1;
          return aRepo.localeCompare(bRepo) * multiplier;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [sort]);

  return {
    sort,
    setSort,
    toggleSort,
    setSortField,
    resetSort,
    sortIssues,
  };
}
