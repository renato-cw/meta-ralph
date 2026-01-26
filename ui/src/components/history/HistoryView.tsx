'use client';

import { useState, useEffect, useCallback } from 'react';
import { HistoryItem } from './HistoryItem';
import type { HistoryEntry } from '@/lib/types';
import type { HistoryFilter } from '@/hooks/useHistory';

interface HistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  filteredEntries: HistoryEntry[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onClearFilter: () => void;
  onRetry?: (entry: HistoryEntry) => void;
  onRemove?: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  onClearFailed: () => void;
  stats: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  availableProviders: string[];
}

export function HistoryView({
  isOpen,
  onClose,
  entries,
  filteredEntries,
  filter,
  onFilterChange,
  onClearFilter,
  onRetry,
  onRemove,
  onClearHistory,
  onClearFailed,
  stats,
  availableProviders,
}: HistoryViewProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleStatusChange = useCallback(
    (status: 'all' | 'completed' | 'failed') => {
      onFilterChange({ ...filter, status });
    },
    [filter, onFilterChange]
  );

  const handleProviderChange = useCallback(
    (provider: string) => {
      onFilterChange({
        ...filter,
        provider: provider === 'all' ? undefined : provider,
      });
    },
    [filter, onFilterChange]
  );

  const handleSearchChange = useCallback(
    (search: string) => {
      onFilterChange({ ...filter, search: search || undefined });
    },
    [filter, onFilterChange]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--background)] border-l border-[var(--border)] z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">Processing History</h2>
            <p className="text-xs text-[var(--muted)]">
              {stats.total} total &bull; {stats.successRate}% success rate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--card)] rounded-md transition-colors"
            aria-label="Close history"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">{stats.completed} completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm">{stats.failed} failed</span>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-[var(--border)] space-y-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={filter.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <select
              value={filter.status || 'all'}
              onChange={(e) =>
                handleStatusChange(e.target.value as 'all' | 'completed' | 'failed')
              }
              className="px-2 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            {/* Provider filter */}
            <select
              value={filter.provider || 'all'}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="px-2 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="all">All Providers</option>
              {availableProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>

            {/* Clear filters */}
            {(filter.status !== 'all' || filter.provider || filter.search) && (
              <button
                onClick={onClearFilter}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              {entries.length === 0 ? (
                <>
                  <svg
                    className="w-12 h-12 mx-auto mb-3 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm">No processing history yet</p>
                  <p className="text-xs mt-1">
                    Process some issues to see history here
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">No matching entries</p>
                  <button
                    onClick={onClearFilter}
                    className="text-xs text-[var(--primary)] hover:underline mt-2"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onRetry={onRetry}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {entries.length > 0 && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
            {showClearConfirm ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">
                  Clear all history?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:bg-[var(--input)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onClearHistory();
                      setShowClearConfirm(false);
                    }}
                    className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {stats.failed > 0 && (
                  <button
                    onClick={onClearFailed}
                    className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:bg-[var(--input)] transition-colors"
                  >
                    Clear Failed ({stats.failed})
                  </button>
                )}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 text-sm rounded text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
