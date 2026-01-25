'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useApp } from '@/contexts';
import { ShortcutsModal } from './ShortcutsModal';
import type { Issue, Severity } from '@/lib/types';

interface KeyboardShortcutsProps {
  /** Reference to the search input element for focus */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Callback when filter bar toggle is requested */
  onToggleFilters?: () => void;
  /** Callback for severity quick-filter toggle */
  onSeverityFilter?: (severity: Severity) => void;
  /** Callback when queue panel toggle is requested */
  onToggleQueue?: () => void;
}

/**
 * Keyboard shortcuts handler component.
 *
 * This component should be rendered once at the page level.
 * It handles all keyboard shortcuts and coordinates with the AppContext.
 *
 * @example
 * <KeyboardShortcuts
 *   searchInputRef={searchRef}
 *   onToggleFilters={() => setFiltersExpanded(prev => !prev)}
 * />
 */
export function KeyboardShortcuts({
  searchInputRef,
  onToggleFilters,
  onSeverityFilter,
  onToggleQueue,
}: KeyboardShortcutsProps) {
  const {
    processedIssues,
    selectedIds,
    handleToggle,
    handleSelectAll,
    handleDeselectAll,
    detailIssue,
    isDetailOpen,
    openDetailPanel,
    closeDetailPanel,
    processing,
    processIssues,
    fetchIssues,
    filters,
    setFilters,
    // Grouping
    groupedIssues,
    collapseAllGroups,
    expandAllGroups,
    cycleGroupBy,
  } = useApp();

  // Focused index for navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showHelp, setShowHelp] = useState(false);

  // Track previous issues length to detect changes
  const prevIssuesLengthRef = useRef<number>(processedIssues.length);

  // Get the currently focused issue
  const focusedIssue: Issue | null = focusedIndex >= 0 && focusedIndex < processedIssues.length
    ? processedIssues[focusedIndex]
    : null;

  // Navigation handlers
  const handleNavigateDown = useCallback(() => {
    setFocusedIndex((prev) => {
      const next = prev + 1;
      if (next >= processedIssues.length) return prev;
      return next;
    });
  }, [processedIssues.length]);

  const handleNavigateUp = useCallback(() => {
    setFocusedIndex((prev) => {
      if (prev <= 0) return 0;
      return prev - 1;
    });
  }, []);

  // Selection handlers
  const handleToggleSelection = useCallback(() => {
    if (focusedIssue) {
      handleToggle(focusedIssue.id);
    }
  }, [focusedIssue, handleToggle]);

  // Detail panel handlers
  const handleToggleDetailPanel = useCallback(() => {
    if (isDetailOpen) {
      closeDetailPanel();
    } else if (focusedIssue) {
      openDetailPanel(focusedIssue);
    }
  }, [isDetailOpen, focusedIssue, openDetailPanel, closeDetailPanel]);

  // Escape handler
  const handleEscape = useCallback(() => {
    if (isDetailOpen) {
      closeDetailPanel();
    } else if (selectedIds.size > 0) {
      handleDeselectAll();
    }
  }, [isDetailOpen, closeDetailPanel, selectedIds.size, handleDeselectAll]);

  // Process selected issues
  const handleProcessSelected = useCallback(() => {
    if (selectedIds.size > 0 && !processing.isProcessing) {
      processIssues(Array.from(selectedIds));
    }
  }, [selectedIds, processing.isProcessing, processIssues]);

  // Focus search
  const handleFocusSearch = useCallback(() => {
    searchInputRef?.current?.focus();
  }, [searchInputRef]);

  // Show help modal
  const handleShowHelp = useCallback(() => {
    setShowHelp(true);
  }, []);

  // Severity quick filter
  const handleSeverityFilter = useCallback((severity: Severity) => {
    if (onSeverityFilter) {
      onSeverityFilter(severity);
    } else {
      // Default behavior: toggle the severity filter
      const currentSeverities = filters.severities;
      if (currentSeverities.includes(severity)) {
        // If already filtered to this severity, clear it
        setFilters({ severities: [] });
      } else {
        // Set filter to only this severity
        setFilters({ severities: [severity] });
      }
    }
  }, [onSeverityFilter, filters.severities, setFilters]);

  // Collapse all groups
  const handleCollapseAll = useCallback(() => {
    collapseAllGroups(groupedIssues);
  }, [collapseAllGroups, groupedIssues]);

  // Expand all groups
  const handleExpandAll = useCallback(() => {
    expandAllGroups();
  }, [expandAllGroups]);

  // Cycle group by
  const handleCycleGroupBy = useCallback(() => {
    cycleGroupBy();
  }, [cycleGroupBy]);

  // Use the keyboard shortcuts hook
  useKeyboardShortcuts({
    onNavigateDown: handleNavigateDown,
    onNavigateUp: handleNavigateUp,
    onToggleSelection: handleToggleSelection,
    onSelectAll: handleSelectAll,
    onDeselectAll: handleDeselectAll,
    onToggleDetailPanel: handleToggleDetailPanel,
    onProcessSelected: handleProcessSelected,
    onEscape: handleEscape,
    onFocusSearch: handleFocusSearch,
    onShowHelp: handleShowHelp,
    onToggleFilters: onToggleFilters,
    onRefresh: fetchIssues,
    onCollapseAll: handleCollapseAll,
    onExpandAll: handleExpandAll,
    onCycleGroupBy: handleCycleGroupBy,
    onFilterBySeverity: handleSeverityFilter,
    onToggleQueue: onToggleQueue,
    enabled: !showHelp, // Disable shortcuts when help modal is open
  });

  // Update detail panel when navigating with keyboard
  useEffect(() => {
    if (isDetailOpen && focusedIssue && detailIssue?.id !== focusedIssue.id) {
      openDetailPanel(focusedIssue);
    }
  }, [focusedIndex, focusedIssue, isDetailOpen, detailIssue, openDetailPanel]);

  // Reset focused index when issues change
  // This is a legitimate pattern to reset navigation state when the data changes
  useEffect(() => {
    const currentLength = processedIssues.length;
    const prevLength = prevIssuesLengthRef.current;

    // Only update if the length has changed and focused index is out of bounds
    if (currentLength !== prevLength && focusedIndex >= currentLength) {
      setFocusedIndex(-1);
    }

    // Update the ref for the next render
    prevIssuesLengthRef.current = currentLength;
  }, [processedIssues.length, focusedIndex]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const row = document.querySelector(`[data-issue-index="${focusedIndex}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex]);

  return (
    <>
      <ShortcutsModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
      {/* Visual indicator for focused row - expose via context or CSS class */}
      <style>{`
        [data-issue-index="${focusedIndex}"] {
          outline: 2px solid var(--accent, #3b82f6);
          outline-offset: -2px;
        }
      `}</style>
    </>
  );
}

/**
 * Hook to get the current focused index.
 * Components can use this to highlight the focused row.
 */
export function useFocusedIndex() {
  // This would be better with a context, but for now we use CSS
  return -1;
}
