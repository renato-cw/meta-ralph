'use client';

import { useEffect, useCallback, useRef } from 'react';
import { SHORTCUTS, matchesShortcut } from '@/lib/shortcuts';
import type { Severity } from '@/lib/types';

export interface KeyboardShortcutsOptions {
  // Navigation
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;

  // Selection
  onToggleSelection?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;

  // Actions
  onToggleDetailPanel?: () => void;
  onProcessSelected?: () => void;
  onEscape?: () => void;

  // UI
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  onToggleFilters?: () => void;
  onRefresh?: () => void;
  onToggleQueue?: () => void;

  // Grouping
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onCycleGroupBy?: () => void;

  // Quick filters
  onFilterBySeverity?: (severity: Severity) => void;

  // Global enabled state
  enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts.
 *
 * @param options - Callback functions for each shortcut action
 *
 * @example
 * useKeyboardShortcuts({
 *   onNavigateDown: () => setFocusedIndex(prev => prev + 1),
 *   onToggleSelection: () => toggleSelect(focusedIssue.id),
 *   onFocusSearch: () => searchRef.current?.focus(),
 * });
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const {
    onNavigateDown,
    onNavigateUp,
    onToggleSelection,
    onSelectAll,
    onDeselectAll,
    onToggleDetailPanel,
    onProcessSelected,
    onEscape,
    onFocusSearch,
    onShowHelp,
    onToggleFilters,
    onRefresh,
    onToggleQueue,
    onCollapseAll,
    onExpandAll,
    onCycleGroupBy,
    onFilterBySeverity,
    enabled = true,
  } = options;

  // Track whether we're in an input element
  const isInputFocused = useRef(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if we're in an input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    isInputFocused.current = isInput;

    // Only certain shortcuts work in input fields
    if (isInput) {
      // Escape always works
      if (matchesShortcut(event, SHORTCUTS.escape)) {
        event.preventDefault();
        // Blur the input first
        target.blur();
        onEscape?.();
        return;
      }
      // Don't handle other shortcuts in input fields
      return;
    }

    // Navigation
    if (matchesShortcut(event, SHORTCUTS.navigateDown) || matchesShortcut(event, SHORTCUTS.navigateDownArrow)) {
      event.preventDefault();
      onNavigateDown?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.navigateUp) || matchesShortcut(event, SHORTCUTS.navigateUpArrow)) {
      event.preventDefault();
      onNavigateUp?.();
      return;
    }

    // Selection
    if (matchesShortcut(event, SHORTCUTS.toggleSelection)) {
      event.preventDefault();
      onToggleSelection?.();
      return;
    }

    // Check deselectAll BEFORE selectAll because deselectAll has more modifiers (shift)
    // and both would match due to case-insensitive key comparison
    if (matchesShortcut(event, SHORTCUTS.deselectAll) || matchesShortcut(event, SHORTCUTS.deselectAllMac)) {
      event.preventDefault();
      onDeselectAll?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.selectAll) || matchesShortcut(event, SHORTCUTS.selectAllMac)) {
      event.preventDefault();
      onSelectAll?.();
      return;
    }

    // Actions
    if (matchesShortcut(event, SHORTCUTS.openDetailPanel)) {
      event.preventDefault();
      onToggleDetailPanel?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.processSelected)) {
      event.preventDefault();
      onProcessSelected?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.escape)) {
      event.preventDefault();
      onEscape?.();
      return;
    }

    // UI
    if (matchesShortcut(event, SHORTCUTS.focusSearch)) {
      event.preventDefault();
      onFocusSearch?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.showHelp)) {
      event.preventDefault();
      onShowHelp?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.focusFilters)) {
      event.preventDefault();
      onToggleFilters?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.refresh)) {
      event.preventDefault();
      onRefresh?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.toggleQueue)) {
      event.preventDefault();
      onToggleQueue?.();
      return;
    }

    // Grouping
    if (matchesShortcut(event, SHORTCUTS.collapseAll)) {
      event.preventDefault();
      onCollapseAll?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.expandAll)) {
      event.preventDefault();
      onExpandAll?.();
      return;
    }

    if (matchesShortcut(event, SHORTCUTS.cycleGroupBy)) {
      event.preventDefault();
      onCycleGroupBy?.();
      return;
    }

    // Quick filters
    if (onFilterBySeverity) {
      if (matchesShortcut(event, SHORTCUTS.filterCritical)) {
        event.preventDefault();
        onFilterBySeverity('CRITICAL');
        return;
      }
      if (matchesShortcut(event, SHORTCUTS.filterHigh)) {
        event.preventDefault();
        onFilterBySeverity('HIGH');
        return;
      }
      if (matchesShortcut(event, SHORTCUTS.filterMedium)) {
        event.preventDefault();
        onFilterBySeverity('MEDIUM');
        return;
      }
      if (matchesShortcut(event, SHORTCUTS.filterLow)) {
        event.preventDefault();
        onFilterBySeverity('LOW');
        return;
      }
      if (matchesShortcut(event, SHORTCUTS.filterInfo)) {
        event.preventDefault();
        onFilterBySeverity('INFO');
        return;
      }
    }
  }, [
    onNavigateDown,
    onNavigateUp,
    onToggleSelection,
    onSelectAll,
    onDeselectAll,
    onToggleDetailPanel,
    onProcessSelected,
    onEscape,
    onFocusSearch,
    onShowHelp,
    onToggleFilters,
    onRefresh,
    onToggleQueue,
    onCollapseAll,
    onExpandAll,
    onCycleGroupBy,
    onFilterBySeverity,
  ]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Return a getter function instead of accessing ref during render
  return {
    getIsInputFocused: () => isInputFocused.current,
  };
}
