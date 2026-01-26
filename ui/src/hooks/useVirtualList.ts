'use client';

import { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { useLocalStorage } from './useLocalStorage';

/**
 * Page size options for the list.
 */
export const PAGE_SIZES = [25, 50, 100, 'all'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface UseVirtualListOptions<T> {
  /** All items in the list */
  items: T[];
  /** Estimated height of each row in pixels */
  estimatedRowHeight?: number;
  /** Whether to enable virtualization (auto-enabled for large lists) */
  enableVirtualization?: boolean;
  /** Threshold for auto-enabling virtualization */
  virtualizationThreshold?: number;
  /** Storage key for persisting page size preference */
  pageSizeStorageKey?: string;
  /** Default page size */
  defaultPageSize?: PageSize;
  /** Overscan count (number of items to render outside viewport) */
  overscan?: number;
}

export interface UseVirtualListResult<T> {
  /** Container ref to attach to the scrollable element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Virtual items to render */
  virtualItems: VirtualItem[];
  /** Total height of the list */
  totalHeight: number;
  /** Items to display (paginated if not virtualized) */
  displayItems: T[];
  /** Current page size setting */
  pageSize: PageSize;
  /** Set page size */
  setPageSize: (size: PageSize) => void;
  /** Total count of items */
  totalCount: number;
  /** Count of items being displayed */
  displayCount: number;
  /** Whether showing all items */
  showingAll: boolean;
  /** Load more items (for "Load More" button functionality) */
  loadMore: () => void;
  /** Current loaded count (for "Load More" mode) */
  loadedCount: number;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Scroll to a specific index */
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => void;
  /** Get item style for positioning (for virtualized items) */
  getItemStyle: (virtualItem: VirtualItem) => React.CSSProperties;
}

/**
 * Hook for managing virtual/paginated lists with consistent interface.
 *
 * Provides:
 * - Automatic virtualization for large lists (100+ items)
 * - Page size selector (25, 50, 100, All)
 * - "Load More" functionality
 * - Persisted page size preference
 *
 * @example
 * const {
 *   containerRef,
 *   virtualItems,
 *   displayItems,
 *   pageSize,
 *   setPageSize,
 *   isVirtualized,
 * } = useVirtualList({
 *   items: issues,
 *   estimatedRowHeight: 52,
 * });
 */
export function useVirtualList<T>({
  items,
  estimatedRowHeight = 52,
  enableVirtualization,
  virtualizationThreshold = 100,
  pageSizeStorageKey = 'meta-ralph-page-size',
  defaultPageSize = 50,
  overscan = 5,
}: UseVirtualListOptions<T>): UseVirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist page size preference
  const [pageSize, setPageSize] = useLocalStorage<PageSize>(
    pageSizeStorageKey,
    defaultPageSize
  );

  // Track "load more" count
  const [loadedCount, setLoadedCount] = useLocalStorage<number>(
    `${pageSizeStorageKey}-loaded`,
    typeof pageSize === 'number' ? pageSize : items.length
  );

  // Determine if virtualization should be enabled
  const shouldVirtualize = useMemo(() => {
    if (enableVirtualization !== undefined) return enableVirtualization;
    return items.length >= virtualizationThreshold;
  }, [items.length, enableVirtualization, virtualizationThreshold]);

  // Calculate display items based on page size
  const displayItems = useMemo(() => {
    if (shouldVirtualize || pageSize === 'all') {
      return items;
    }
    // For "load more" functionality, use loadedCount
    return items.slice(0, Math.min(loadedCount, items.length));
  }, [items, pageSize, shouldVirtualize, loadedCount]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  // Virtual items from the virtualizer
  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const totalHeight = shouldVirtualize ? virtualizer.getTotalSize() : 0;

  // Load more handler
  const loadMore = useCallback(() => {
    const increment = typeof pageSize === 'number' ? pageSize : 25;
    setLoadedCount((prev) => Math.min(prev + increment, items.length));
  }, [pageSize, items.length, setLoadedCount]);

  // Handle page size changes
  const handleSetPageSize = useCallback((size: PageSize) => {
    setPageSize(size);
    // Reset loaded count when changing page size
    if (size === 'all') {
      setLoadedCount(items.length);
    } else {
      setLoadedCount(size);
    }
  }, [setPageSize, setLoadedCount, items.length]);

  // Scroll to index
  const scrollToIndex = useCallback((index: number, options?: { align?: 'start' | 'center' | 'end' }) => {
    if (shouldVirtualize) {
      virtualizer.scrollToIndex(index, options);
    } else {
      // For non-virtualized, try to scroll to the row element
      const row = containerRef.current?.querySelector(`[data-row-index="${index}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: options?.align || 'nearest' });
    }
  }, [shouldVirtualize, virtualizer]);

  // Get item style for virtualized items
  const getItemStyle = useCallback((virtualItem: VirtualItem): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${virtualItem.size}px`,
    transform: `translateY(${virtualItem.start}px)`,
  }), []);

  const showingAll = pageSize === 'all' || displayItems.length >= items.length;
  const hasMore = !shouldVirtualize && displayItems.length < items.length;

  return {
    containerRef,
    isVirtualized: shouldVirtualize,
    virtualItems,
    totalHeight,
    displayItems,
    pageSize,
    setPageSize: handleSetPageSize,
    totalCount: items.length,
    displayCount: shouldVirtualize ? items.length : displayItems.length,
    showingAll,
    loadMore,
    loadedCount,
    hasMore,
    scrollToIndex,
    getItemStyle,
  };
}

/**
 * Hook for persisting page size preference without virtualization.
 * Lighter weight than useVirtualList for simple pagination.
 */
export function usePageSize(storageKey = 'meta-ralph-page-size', defaultSize: PageSize = 50) {
  const [pageSize, setPageSize] = useLocalStorage<PageSize>(storageKey, defaultSize);
  return { pageSize, setPageSize };
}
