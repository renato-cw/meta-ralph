/**
 * Hook for managing issue grouping state.
 *
 * Provides state management for grouping issues by different fields
 * (provider, severity, date, location) with collapsed group tracking.
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Issue, GroupBy, Severity } from '@/lib/types';
import { SEVERITY_ORDER } from '@/lib/types';

export interface GroupedIssues {
  key: string;
  label: string;
  issues: Issue[];
  count: number;
}

interface UseGroupingOptions {
  /**
   * Storage key for persisting collapsed groups.
   * @default 'meta-ralph-collapsed-groups'
   */
  storageKey?: string;
  /**
   * Storage key for persisting group by preference.
   * @default 'meta-ralph-group-by'
   */
  groupByStorageKey?: string;
}

interface UseGroupingReturn {
  /** Current grouping field */
  groupBy: GroupBy;
  /** Set the grouping field */
  setGroupBy: (groupBy: GroupBy) => void;
  /** Cycle through grouping options */
  cycleGroupBy: () => void;
  /** Set of collapsed group keys */
  collapsedGroups: Set<string>;
  /** Toggle a group's collapsed state */
  toggleGroup: (key: string) => void;
  /** Collapse all groups */
  collapseAll: () => void;
  /** Expand all groups */
  expandAll: () => void;
  /** Check if a group is collapsed */
  isCollapsed: (key: string) => boolean;
  /** Group issues by the current groupBy field */
  groupIssues: (issues: Issue[]) => GroupedIssues[];
  /** Number of collapsed groups */
  collapsedCount: number;
}

const GROUP_BY_OPTIONS: GroupBy[] = [null, 'provider', 'severity', 'date', 'location'];

/**
 * Get a display label for a group key.
 */
function getGroupLabel(groupBy: GroupBy, key: string): string {
  if (!groupBy) return key;

  switch (groupBy) {
    case 'provider':
      // Capitalize provider name
      return key.charAt(0).toUpperCase() + key.slice(1);
    case 'severity':
      return key;
    case 'date':
      return key;
    case 'location':
      // Truncate long file paths
      if (key.length > 50) {
        return '...' + key.slice(-47);
      }
      return key;
    default:
      return key;
  }
}

/**
 * Get the group key for an issue based on groupBy field.
 */
function getGroupKey(issue: Issue, groupBy: GroupBy): string {
  if (!groupBy) return 'all';

  switch (groupBy) {
    case 'provider':
      return issue.provider;
    case 'severity':
      return issue.severity;
    case 'date': {
      // Group by relative date
      const now = new Date();
      const lastSeen = issue.metadata?.lastSeen as string | undefined;
      if (!lastSeen) return 'Unknown Date';

      const date = new Date(lastSeen);
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays <= 7) return 'This Week';
      if (diffDays <= 30) return 'This Month';
      return 'Older';
    }
    case 'location': {
      // Group by directory
      const location = issue.location || 'Unknown';
      const lastSlash = location.lastIndexOf('/');
      if (lastSlash === -1) return 'Root';
      return location.substring(0, lastSlash) || 'Root';
    }
    default:
      return 'all';
  }
}

/**
 * Sort order for groups.
 */
function getGroupSortOrder(groupBy: GroupBy, key: string): number {
  switch (groupBy) {
    case 'severity':
      return SEVERITY_ORDER[key as Severity] ?? 999;
    case 'date': {
      const dateOrder: Record<string, number> = {
        'Today': 0,
        'Yesterday': 1,
        'This Week': 2,
        'This Month': 3,
        'Older': 4,
        'Unknown Date': 5,
      };
      return dateOrder[key] ?? 999;
    }
    default:
      return 0; // Alphabetical order for providers and locations
  }
}

export function useGrouping(options: UseGroupingOptions = {}): UseGroupingReturn {
  const {
    storageKey = 'meta-ralph-collapsed-groups',
    groupByStorageKey = 'meta-ralph-group-by',
  } = options;

  // Persist groupBy preference
  const [groupBy, setGroupByStorage] = useLocalStorage<GroupBy>(groupByStorageKey, null);

  // Persist collapsed groups (as array for JSON serialization)
  const [collapsedArray, setCollapsedArray] = useLocalStorage<string[]>(storageKey, []);

  // Convert array to Set for efficient lookups
  const collapsedGroups = useMemo(() => new Set(collapsedArray), [collapsedArray]);

  const setGroupBy = useCallback((newGroupBy: GroupBy) => {
    setGroupByStorage(newGroupBy);
    // Clear collapsed groups when changing groupBy
    setCollapsedArray([]);
  }, [setGroupByStorage, setCollapsedArray]);

  const cycleGroupBy = useCallback(() => {
    const currentIndex = GROUP_BY_OPTIONS.indexOf(groupBy);
    const nextIndex = (currentIndex + 1) % GROUP_BY_OPTIONS.length;
    setGroupBy(GROUP_BY_OPTIONS[nextIndex]);
  }, [groupBy, setGroupBy]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedArray((prev) => {
      const set = new Set(prev);
      if (set.has(key)) {
        set.delete(key);
      } else {
        set.add(key);
      }
      return Array.from(set);
    });
  }, [setCollapsedArray]);

  const expandAll = useCallback(() => {
    setCollapsedArray([]);
  }, [setCollapsedArray]);

  const isCollapsed = useCallback((key: string) => {
    return collapsedGroups.has(key);
  }, [collapsedGroups]);

  const groupIssues = useCallback((issues: Issue[]): GroupedIssues[] => {
    if (!groupBy) {
      // No grouping - return single group with all issues
      return [{
        key: 'all',
        label: 'All Issues',
        issues,
        count: issues.length,
      }];
    }

    // Group issues by the specified field
    const groups = new Map<string, Issue[]>();

    for (const issue of issues) {
      const key = getGroupKey(issue, groupBy);
      const existing = groups.get(key) || [];
      groups.set(key, [...existing, issue]);
    }

    // Convert to array and sort
    const result: GroupedIssues[] = Array.from(groups.entries()).map(([key, groupIssues]) => ({
      key,
      label: getGroupLabel(groupBy, key),
      issues: groupIssues,
      count: groupIssues.length,
    }));

    // Sort groups
    result.sort((a, b) => {
      const orderA = getGroupSortOrder(groupBy, a.key);
      const orderB = getGroupSortOrder(groupBy, b.key);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Alphabetical fallback
      return a.key.localeCompare(b.key);
    });

    return result;
  }, [groupBy]);

  // Create a version of collapseAll that takes keys
  const collapseAllWithKeys = useCallback((groups: GroupedIssues[]) => {
    setCollapsedArray(groups.map((g) => g.key));
  }, [setCollapsedArray]);

  return {
    groupBy,
    setGroupBy,
    cycleGroupBy,
    collapsedGroups,
    toggleGroup,
    collapseAll: collapseAllWithKeys as unknown as () => void,
    expandAll,
    isCollapsed,
    groupIssues,
    collapsedCount: collapsedGroups.size,
  };
}

export default useGrouping;
