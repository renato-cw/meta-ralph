'use client';

import { PAGE_SIZES, type PageSize } from '@/hooks/useVirtualList';

interface PageSizeSelectorProps {
  /** Current page size */
  value: PageSize;
  /** Callback when page size changes */
  onChange: (size: PageSize) => void;
  /** Total number of items */
  totalCount: number;
  /** Number of items currently displayed */
  displayCount: number;
  /** Whether showing all items */
  showingAll: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Selector for choosing how many items to display per page.
 * Options: 25, 50, 100, All
 */
export function PageSizeSelector({
  value,
  onChange,
  totalCount,
  displayCount,
  showingAll,
  className = '',
}: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm text-[var(--muted)]">
        Showing {displayCount} of {totalCount}
        {showingAll && totalCount > 0 && ' (all)'}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--muted)]">Show:</span>
        <select
          value={value === 'all' ? 'all' : value.toString()}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === 'all' ? 'all' : parseInt(val, 10) as PageSize);
          }}
          className="px-2 py-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded hover:border-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size === 'all' ? 'all' : size}>
              {size === 'all' ? 'All' : size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface LoadMoreButtonProps {
  /** Callback when load more is clicked */
  onClick: () => void;
  /** Number of items currently loaded */
  loadedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Button for loading more items in a paginated list.
 */
export function LoadMoreButton({
  onClick,
  loadedCount,
  totalCount,
  hasMore,
  className = '',
}: LoadMoreButtonProps) {
  if (!hasMore) return null;

  const remaining = totalCount - loadedCount;

  return (
    <button
      onClick={onClick}
      className={`w-full py-3 text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] hover:bg-[var(--card)] border border-[var(--border)] border-t-0 rounded-b-lg transition-colors ${className}`}
    >
      Load More ({remaining} remaining)
    </button>
  );
}
