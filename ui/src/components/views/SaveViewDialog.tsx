'use client';

import { useState, useRef, useEffect } from 'react';
import type { FilterState, SortState, GroupBy } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

interface SaveViewDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when view is saved */
  onSave: (name: string) => void;
  /** Current filter state (for display) */
  currentFilters: FilterState;
  /** Current sort state (for display) */
  currentSort: SortState;
  /** Current group by (for display) */
  currentGroupBy: GroupBy;
}

// ============================================================================
// Helpers
// ============================================================================

function describeFilters(filters: FilterState): string[] {
  const descriptions: string[] = [];

  if (filters.providers.length > 0) {
    descriptions.push(`Providers: ${filters.providers.join(', ')}`);
  }

  if (filters.severities.length > 0) {
    descriptions.push(`Severities: ${filters.severities.join(', ')}`);
  }

  if (filters.priorityRange[0] > 0 || filters.priorityRange[1] < 100) {
    descriptions.push(`Priority: ${filters.priorityRange[0]}-${filters.priorityRange[1]}`);
  }

  if (filters.status.length > 0) {
    descriptions.push(`Status: ${filters.status.join(', ')}`);
  }

  if (filters.tags.length > 0) {
    descriptions.push(`Tags: ${filters.tags.join(', ')}`);
  }

  if (filters.search) {
    descriptions.push(`Search: "${filters.search}"`);
  }

  return descriptions;
}

function describeSort(sort: SortState): string {
  const fieldLabels: Record<string, string> = {
    priority: 'Priority',
    severity: 'Severity',
    count: 'Count',
    title: 'Title',
    provider: 'Provider',
    firstSeen: 'First Seen',
    lastSeen: 'Last Seen',
  };

  const field = fieldLabels[sort.field] || sort.field;
  const direction = sort.direction === 'asc' ? 'ascending' : 'descending';

  return `${field} (${direction})`;
}

function describeGroupBy(groupBy: GroupBy): string {
  if (!groupBy) return 'None';

  const labels: Record<string, string> = {
    provider: 'Provider',
    severity: 'Severity',
    date: 'Date',
    location: 'Location',
  };

  return labels[groupBy] || groupBy;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dialog for saving the current filter/sort/grouping state as a named view.
 *
 * Shows a preview of what will be saved and allows the user to enter a name.
 */
export function SaveViewDialog({
  isOpen,
  onClose,
  onSave,
  currentFilters,
  currentSort,
  currentGroupBy,
}: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setName('');
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name for this view');
      return;
    }

    onSave(trimmedName);
    onClose();
  };

  const filterDescriptions = describeFilters(currentFilters);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-view-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 id="save-view-title" className="text-lg font-semibold text-[var(--foreground)]">
            Save Current View
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* Name input */}
            <div>
              <label
                htmlFor="view-name"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                View Name
              </label>
              <input
                ref={inputRef}
                id="view-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Critical Security Issues"
                className="w-full px-3 py-2 text-sm bg-[var(--input)] text-[var(--foreground)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                autoComplete="off"
              />
              {error && (
                <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
              )}
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
                This view will include:
              </h3>
              <div className="p-3 bg-[var(--background)] rounded-md text-sm space-y-2">
                {/* Filters */}
                {filterDescriptions.length > 0 ? (
                  <div>
                    <span className="text-[var(--muted)]">Filters:</span>
                    <ul className="mt-1 ml-4 list-disc text-[var(--foreground)]">
                      {filterDescriptions.map((desc, i) => (
                        <li key={i}>{desc}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-[var(--muted)]">No active filters</div>
                )}

                {/* Sort */}
                <div>
                  <span className="text-[var(--muted)]">Sort: </span>
                  <span className="text-[var(--foreground)]">{describeSort(currentSort)}</span>
                </div>

                {/* Group by */}
                <div>
                  <span className="text-[var(--muted)]">Group by: </span>
                  <span className="text-[var(--foreground)]">{describeGroupBy(currentGroupBy)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--background)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-md hover:bg-[var(--primary-hover)] transition-colors"
            >
              Save View
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
