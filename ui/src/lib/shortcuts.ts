/**
 * Keyboard shortcut definitions and utilities.
 *
 * This module defines all available keyboard shortcuts and provides
 * utilities for formatting and displaying them.
 */

export interface ShortcutDefinition {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  category: 'navigation' | 'selection' | 'actions' | 'ui' | 'quick-filters';
}

/**
 * All available keyboard shortcuts.
 */
export const SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Navigation
  navigateDown: {
    key: 'j',
    description: 'Navigate to next issue',
    category: 'navigation',
  },
  navigateDownArrow: {
    key: 'ArrowDown',
    description: 'Navigate to next issue',
    category: 'navigation',
  },
  navigateUp: {
    key: 'k',
    description: 'Navigate to previous issue',
    category: 'navigation',
  },
  navigateUpArrow: {
    key: 'ArrowUp',
    description: 'Navigate to previous issue',
    category: 'navigation',
  },

  // Selection
  toggleSelection: {
    key: 'x',
    description: 'Toggle issue selection',
    category: 'selection',
  },
  selectAll: {
    key: 'a',
    ctrlKey: true,
    description: 'Select all filtered issues',
    category: 'selection',
  },
  selectAllMac: {
    key: 'a',
    metaKey: true,
    description: 'Select all filtered issues',
    category: 'selection',
  },
  deselectAll: {
    key: 'A',
    ctrlKey: true,
    shiftKey: true,
    description: 'Deselect all issues',
    category: 'selection',
  },
  deselectAllMac: {
    key: 'A',
    metaKey: true,
    shiftKey: true,
    description: 'Deselect all issues',
    category: 'selection',
  },

  // Actions
  openDetailPanel: {
    key: ' ',
    description: 'Open/close detail panel',
    category: 'actions',
  },
  processSelected: {
    key: 'Enter',
    description: 'Process selected issues',
    category: 'actions',
  },
  escape: {
    key: 'Escape',
    description: 'Close panel / Clear selection',
    category: 'actions',
  },

  // UI
  focusSearch: {
    key: '/',
    description: 'Focus search bar',
    category: 'ui',
  },
  showHelp: {
    key: '?',
    description: 'Show keyboard shortcuts help',
    category: 'ui',
  },
  focusFilters: {
    key: 'f',
    description: 'Toggle filter bar',
    category: 'ui',
  },
  refresh: {
    key: 'r',
    description: 'Refresh issues',
    category: 'ui',
  },
  collapseAll: {
    key: 'c',
    description: 'Collapse all groups',
    category: 'ui',
  },
  expandAll: {
    key: 'e',
    description: 'Expand all groups',
    category: 'ui',
  },
  cycleGroupBy: {
    key: 'g',
    description: 'Cycle group by options',
    category: 'ui',
  },

  // Quick filters by severity
  filterCritical: {
    key: '1',
    description: 'Filter: Critical only',
    category: 'quick-filters',
  },
  filterHigh: {
    key: '2',
    description: 'Filter: High only',
    category: 'quick-filters',
  },
  filterMedium: {
    key: '3',
    description: 'Filter: Medium only',
    category: 'quick-filters',
  },
  filterLow: {
    key: '4',
    description: 'Filter: Low only',
    category: 'quick-filters',
  },
  filterInfo: {
    key: '5',
    description: 'Filter: Info only',
    category: 'quick-filters',
  },
};

/**
 * Format a shortcut key for display.
 */
export function formatShortcutKey(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('Cmd');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');

  // Format the key nicely
  let keyDisplay = shortcut.key;
  switch (shortcut.key) {
    case ' ':
      keyDisplay = 'Space';
      break;
    case 'ArrowDown':
      keyDisplay = '\u2193';
      break;
    case 'ArrowUp':
      keyDisplay = '\u2191';
      break;
    case 'ArrowLeft':
      keyDisplay = '\u2190';
      break;
    case 'ArrowRight':
      keyDisplay = '\u2192';
      break;
    case 'Escape':
      keyDisplay = 'Esc';
      break;
    case 'Enter':
      keyDisplay = '\u21B5';
      break;
    default:
      if (keyDisplay.length === 1) {
        keyDisplay = keyDisplay.toUpperCase();
      }
  }

  parts.push(keyDisplay);
  return parts.join('+');
}

/**
 * Get shortcuts grouped by category.
 */
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const categories: Record<string, ShortcutDefinition[]> = {
    navigation: [],
    selection: [],
    actions: [],
    ui: [],
    'quick-filters': [],
  };

  // Group shortcuts, avoiding duplicates (like arrow keys and j/k)
  const seen = new Set<string>();

  Object.values(SHORTCUTS).forEach((shortcut) => {
    // Skip Mac-specific duplicates in the help display
    if (shortcut.metaKey && !shortcut.ctrlKey) return;

    const key = shortcut.description;
    if (!seen.has(key)) {
      seen.add(key);
      categories[shortcut.category].push(shortcut);
    }
  });

  return categories;
}

/**
 * Category display names.
 */
export const CATEGORY_NAMES: Record<string, string> = {
  navigation: 'Navigation',
  selection: 'Selection',
  actions: 'Actions',
  ui: 'Interface',
  'quick-filters': 'Quick Filters',
};

/**
 * Check if a keyboard event matches a shortcut.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  // Check modifier keys
  if (shortcut.ctrlKey && !event.ctrlKey) return false;
  if (shortcut.metaKey && !event.metaKey) return false;
  if (shortcut.shiftKey && !event.shiftKey) return false;
  if (shortcut.altKey && !event.altKey) return false;

  // For shortcuts without modifiers, make sure no modifiers are pressed
  if (!shortcut.ctrlKey && !shortcut.metaKey && !shortcut.shiftKey && !shortcut.altKey) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    // Allow shift for symbols like '?' which require shift
    if (event.shiftKey && !['?', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'].includes(shortcut.key)) {
      return false;
    }
  }

  // Check the key
  if (shortcut.code) {
    return event.code === shortcut.code;
  }

  return event.key === shortcut.key || event.key.toLowerCase() === shortcut.key.toLowerCase();
}
