'use client';

import { useCallback } from 'react';
import type { GroupBy } from '@/lib/types';

interface GroupHeaderProps {
  /** Unique key for this group */
  groupKey: string;
  /** Display label for the group */
  label: string;
  /** Number of issues in this group */
  count: number;
  /** Whether this group is collapsed */
  isCollapsed: boolean;
  /** Callback when the group is toggled */
  onToggle: (key: string) => void;
  /** The field being grouped by */
  groupBy: GroupBy;
  /** Number of selected items in this group */
  selectedCount?: number;
}

/**
 * Get an icon for the group based on groupBy type.
 */
function getGroupIcon(groupBy: GroupBy, label: string): string {
  switch (groupBy) {
    case 'provider':
      // Provider-specific icons
      switch (label.toLowerCase()) {
        case 'zeropath':
          return 'Z';
        case 'sentry':
          return 'S';
        case 'codecov':
          return 'C';
        case 'github':
          return 'G';
        default:
          return label[0]?.toUpperCase() || '?';
      }
    case 'severity':
      // Severity icons using first letter
      return label[0] || '?';
    case 'date':
      // Calendar icon representation
      return label[0] || '?';
    case 'location':
      // Folder icon representation
      return label[0] || '?';
    default:
      return label[0] || '?';
  }
}

/**
 * Get background color for the icon based on groupBy and label.
 */
function getIconColor(groupBy: GroupBy, label: string): string {
  if (groupBy === 'severity') {
    switch (label) {
      case 'CRITICAL':
        return 'bg-red-900/50 text-red-300';
      case 'HIGH':
        return 'bg-orange-900/50 text-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'LOW':
        return 'bg-green-900/50 text-green-300';
      case 'INFO':
        return 'bg-blue-900/50 text-blue-300';
      default:
        return 'bg-[var(--card)] text-[var(--muted)]';
    }
  }

  if (groupBy === 'provider') {
    switch (label.toLowerCase()) {
      case 'zeropath':
        return 'bg-purple-900/50 text-purple-300';
      case 'sentry':
        return 'bg-orange-900/50 text-orange-300';
      case 'codecov':
        return 'bg-green-900/50 text-green-300';
      case 'github':
        return 'bg-gray-700 text-gray-300';
      default:
        return 'bg-[var(--card)] text-[var(--muted)]';
    }
  }

  if (groupBy === 'date') {
    switch (label) {
      case 'Today':
        return 'bg-blue-900/50 text-blue-300';
      case 'Yesterday':
        return 'bg-cyan-900/50 text-cyan-300';
      case 'This Week':
        return 'bg-teal-900/50 text-teal-300';
      case 'This Month':
        return 'bg-green-900/50 text-green-300';
      case 'Older':
        return 'bg-gray-700 text-gray-400';
      default:
        return 'bg-[var(--card)] text-[var(--muted)]';
    }
  }

  return 'bg-[var(--card)] text-[var(--muted)]';
}

/**
 * Collapsible group header for grouped issue view.
 *
 * Displays a clickable header with:
 * - Collapse/expand chevron
 * - Group icon/badge
 * - Group label
 * - Issue count badge
 * - Optional selection count
 */
export function GroupHeader({
  groupKey,
  label,
  count,
  isCollapsed,
  onToggle,
  groupBy,
  selectedCount = 0,
}: GroupHeaderProps) {
  const handleClick = useCallback(() => {
    onToggle(groupKey);
  }, [onToggle, groupKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(groupKey);
      }
    },
    [onToggle, groupKey]
  );

  const icon = getGroupIcon(groupBy, label);
  const iconColor = getIconColor(groupBy, label);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--card)]/80 transition-colors select-none group"
      aria-expanded={!isCollapsed}
      aria-controls={`group-content-${groupKey}`}
    >
      {/* Collapse/Expand chevron */}
      <span
        className={`text-[var(--muted)] transition-transform duration-200 ${
          isCollapsed ? '-rotate-90' : 'rotate-0'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Group icon */}
      <span
        className={`flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${iconColor}`}
      >
        {icon}
      </span>

      {/* Group label */}
      <span className="font-medium text-[var(--foreground)] flex-1">{label}</span>

      {/* Selection count (if any selected) */}
      {selectedCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-300 rounded">
          {selectedCount} selected
        </span>
      )}

      {/* Issue count badge */}
      <span className="px-2 py-0.5 text-xs font-medium bg-[var(--background)] text-[var(--muted)] rounded border border-[var(--border)]">
        {count} {count === 1 ? 'issue' : 'issues'}
      </span>
    </div>
  );
}

export default GroupHeader;
