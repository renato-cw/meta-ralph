'use client';

import { useCallback } from 'react';
import type { GroupBy } from '@/lib/types';

interface ViewToggleProps {
  /** Current groupBy value */
  groupBy: GroupBy;
  /** Callback when groupBy changes */
  onGroupByChange: (groupBy: GroupBy) => void;
  /** Whether any groups are collapsed */
  hasCollapsedGroups?: boolean;
  /** Callback to collapse all groups */
  onCollapseAll?: () => void;
  /** Callback to expand all groups */
  onExpandAll?: () => void;
  /** Total number of groups */
  groupCount?: number;
  /** Number of collapsed groups */
  collapsedCount?: number;
}

interface GroupOption {
  value: GroupBy;
  label: string;
  icon: string;
  description: string;
}

const GROUP_OPTIONS: GroupOption[] = [
  {
    value: null,
    label: 'None',
    icon: '=',
    description: 'Flat table view',
  },
  {
    value: 'provider',
    label: 'Provider',
    icon: 'P',
    description: 'Group by source provider',
  },
  {
    value: 'severity',
    label: 'Severity',
    icon: 'S',
    description: 'Group by severity level',
  },
  {
    value: 'date',
    label: 'Date',
    icon: 'D',
    description: 'Group by relative date',
  },
  {
    value: 'location',
    label: 'Location',
    icon: 'L',
    description: 'Group by file directory',
  },
];

/**
 * Toggle component for switching between different issue grouping options.
 *
 * Provides:
 * - Dropdown to select groupBy field
 * - Collapse/Expand all buttons (when grouped)
 * - Visual indicator of current grouping
 */
export function ViewToggle({
  groupBy,
  onGroupByChange,
  hasCollapsedGroups,
  onCollapseAll,
  onExpandAll,
  groupCount = 0,
  collapsedCount = 0,
}: ViewToggleProps) {
  const handleGroupByChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onGroupByChange(value === 'null' ? null : (value as GroupBy));
    },
    [onGroupByChange]
  );

  const currentOption = GROUP_OPTIONS.find((opt) => opt.value === groupBy) || GROUP_OPTIONS[0];
  const isGrouped = groupBy !== null;

  return (
    <div className="flex items-center gap-3">
      {/* Group By Selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="group-by" className="text-sm text-[var(--muted)]">
          Group by:
        </label>
        <div className="relative">
          <select
            id="group-by"
            value={groupBy ?? 'null'}
            onChange={handleGroupByChange}
            className="appearance-none px-3 py-1.5 pr-8 text-sm bg-[var(--card)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 transition-colors"
            title={currentOption.description}
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.value ?? 'null'} value={option.value ?? 'null'}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Dropdown arrow */}
          <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 5L6 8L9 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>

      {/* Collapse/Expand buttons - only show when grouped */}
      {isGrouped && groupCount > 0 && (
        <div className="flex items-center gap-1 border-l border-[var(--border)] pl-3">
          <button
            onClick={onCollapseAll}
            disabled={collapsedCount === groupCount}
            className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Collapse all groups (c)"
          >
            <span className="flex items-center gap-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 5L7 9L11 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(180 7 7)"
                />
                <path
                  d="M3 9L7 5L11 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Collapse
            </span>
          </button>
          <button
            onClick={onExpandAll}
            disabled={collapsedCount === 0}
            className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Expand all groups (e)"
          >
            <span className="flex items-center gap-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 5L7 9L11 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 9L7 5L11 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(180 7 7)"
                />
              </svg>
              Expand
            </span>
          </button>

          {/* Status indicator */}
          {collapsedCount > 0 && (
            <span className="text-xs text-[var(--muted)] ml-1">
              ({collapsedCount}/{groupCount} collapsed)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ViewToggle;
