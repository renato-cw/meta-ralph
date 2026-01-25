'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type {
  SavedView,
  FilterState,
  SortState,
  GroupBy,
} from '@/lib/types';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'meta-ralph-saved-views';

// ============================================================================
// Types
// ============================================================================

export interface UseSavedViewsOptions {
  /** Current filter state to use when saving */
  currentFilters: FilterState;
  /** Current sort state to use when saving */
  currentSort: SortState;
  /** Current group by to use when saving */
  currentGroupBy: GroupBy;
  /** Callback when a view is loaded */
  onLoadView?: (view: SavedView) => void;
}

export interface UseSavedViewsReturn {
  /** List of all saved views */
  views: SavedView[];
  /** The currently active view (if any) */
  activeView: SavedView | null;
  /** Set the active view by ID */
  setActiveView: (id: string | null) => void;
  /** Save current state as a new view */
  saveView: (name: string) => SavedView;
  /** Update an existing view */
  updateView: (id: string, updates: Partial<Pick<SavedView, 'name' | 'filters' | 'sort' | 'groupBy' | 'isDefault'>>) => void;
  /** Delete a view by ID */
  deleteView: (id: string) => void;
  /** Load a view's settings */
  loadView: (id: string) => void;
  /** Set a view as the default */
  setDefaultView: (id: string | null) => void;
  /** Get the default view (if any) */
  defaultView: SavedView | null;
  /** Check if current state matches a saved view */
  matchesView: (id: string) => boolean;
  /** Rename a view */
  renameView: (id: string, newName: string) => void;
  /** Duplicate a view */
  duplicateView: (id: string) => SavedView;
  /** Export views as JSON string */
  exportViews: () => string;
  /** Import views from JSON string */
  importViews: (jsonString: string) => number;
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function compareFilters(a: FilterState, b: FilterState): boolean {
  return (
    JSON.stringify(a.providers.sort()) === JSON.stringify(b.providers.sort()) &&
    JSON.stringify(a.severities.sort()) === JSON.stringify(b.severities.sort()) &&
    a.priorityRange[0] === b.priorityRange[0] &&
    a.priorityRange[1] === b.priorityRange[1] &&
    a.dateRange.start === b.dateRange.start &&
    a.dateRange.end === b.dateRange.end &&
    a.countRange.min === b.countRange.min &&
    a.countRange.max === b.countRange.max &&
    JSON.stringify(a.status.sort()) === JSON.stringify(b.status.sort()) &&
    JSON.stringify(a.tags.sort()) === JSON.stringify(b.tags.sort()) &&
    a.search === b.search
  );
}

function compareSort(a: SortState, b: SortState): boolean {
  return a.field === b.field && a.direction === b.direction;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing saved filter/sort/grouping views.
 *
 * Views are persisted to localStorage and can be loaded, saved, updated,
 * deleted, and exported/imported.
 *
 * @example
 * const {
 *   views,
 *   activeView,
 *   saveView,
 *   loadView,
 *   deleteView,
 * } = useSavedViews({
 *   currentFilters: filters,
 *   currentSort: sort,
 *   currentGroupBy: groupBy,
 *   onLoadView: (view) => {
 *     setFilters(view.filters);
 *     setSort(view.sort);
 *     setGroupBy(view.groupBy);
 *   },
 * });
 */
export function useSavedViews({
  currentFilters,
  currentSort,
  currentGroupBy,
  onLoadView,
}: UseSavedViewsOptions): UseSavedViewsReturn {
  const [views, setViews] = useLocalStorage<SavedView[]>(STORAGE_KEY, []);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Find the active view
  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? null,
    [views, activeViewId]
  );

  // Find the default view
  const defaultView = useMemo(
    () => views.find((v) => v.isDefault) ?? null,
    [views]
  );

  // Load default view on mount
  useEffect(() => {
    if (defaultView && !activeViewId) {
      setActiveViewId(defaultView.id);
      onLoadView?.(defaultView);
    }
  }, [defaultView, activeViewId, onLoadView]);

  // Set active view
  const setActiveView = useCallback((id: string | null) => {
    setActiveViewId(id);
  }, []);

  // Save a new view
  const saveView = useCallback(
    (name: string): SavedView => {
      const now = new Date().toISOString();
      const newView: SavedView = {
        id: generateId(),
        name,
        filters: { ...currentFilters },
        sort: { ...currentSort },
        groupBy: currentGroupBy,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };

      setViews((prev) => [...prev, newView]);
      setActiveViewId(newView.id);

      return newView;
    },
    [currentFilters, currentSort, currentGroupBy, setViews]
  );

  // Update an existing view
  const updateView = useCallback(
    (
      id: string,
      updates: Partial<Pick<SavedView, 'name' | 'filters' | 'sort' | 'groupBy' | 'isDefault'>>
    ) => {
      setViews((prev) =>
        prev.map((view) => {
          if (view.id !== id) {
            // If setting this view as default, unset others
            if (updates.isDefault) {
              return { ...view, isDefault: false };
            }
            return view;
          }
          return {
            ...view,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [setViews]
  );

  // Delete a view
  const deleteView = useCallback(
    (id: string) => {
      setViews((prev) => prev.filter((v) => v.id !== id));
      if (activeViewId === id) {
        setActiveViewId(null);
      }
    },
    [setViews, activeViewId]
  );

  // Load a view's settings
  const loadView = useCallback(
    (id: string) => {
      const view = views.find((v) => v.id === id);
      if (view) {
        setActiveViewId(id);
        onLoadView?.(view);
      }
    },
    [views, onLoadView]
  );

  // Set a view as default
  const setDefaultView = useCallback(
    (id: string | null) => {
      setViews((prev) =>
        prev.map((view) => ({
          ...view,
          isDefault: view.id === id,
          updatedAt: view.id === id ? new Date().toISOString() : view.updatedAt,
        }))
      );
    },
    [setViews]
  );

  // Check if current state matches a view
  const matchesView = useCallback(
    (id: string): boolean => {
      const view = views.find((v) => v.id === id);
      if (!view) return false;

      return (
        compareFilters(currentFilters, view.filters) &&
        compareSort(currentSort, view.sort) &&
        currentGroupBy === view.groupBy
      );
    },
    [views, currentFilters, currentSort, currentGroupBy]
  );

  // Rename a view
  const renameView = useCallback(
    (id: string, newName: string) => {
      updateView(id, { name: newName });
    },
    [updateView]
  );

  // Duplicate a view
  const duplicateView = useCallback(
    (id: string): SavedView => {
      const original = views.find((v) => v.id === id);
      if (!original) {
        throw new Error(`View with id ${id} not found`);
      }

      const now = new Date().toISOString();
      const duplicate: SavedView = {
        ...original,
        id: generateId(),
        name: `${original.name} (Copy)`,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };

      setViews((prev) => [...prev, duplicate]);

      return duplicate;
    },
    [views, setViews]
  );

  // Export views as JSON
  const exportViews = useCallback((): string => {
    return JSON.stringify(views, null, 2);
  }, [views]);

  // Import views from JSON
  const importViews = useCallback(
    (jsonString: string): number => {
      try {
        const imported = JSON.parse(jsonString) as SavedView[];

        if (!Array.isArray(imported)) {
          throw new Error('Invalid format: expected array');
        }

        // Validate and assign new IDs to avoid conflicts
        const newViews = imported.map((view) => ({
          ...view,
          id: generateId(),
          isDefault: false, // Don't import default status
          createdAt: view.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        setViews((prev) => [...prev, ...newViews]);

        return newViews.length;
      } catch {
        throw new Error('Failed to parse views JSON');
      }
    },
    [setViews]
  );

  return {
    views,
    activeView,
    setActiveView,
    saveView,
    updateView,
    deleteView,
    loadView,
    setDefaultView,
    defaultView,
    matchesView,
    renameView,
    duplicateView,
    exportViews,
    importViews,
  };
}
