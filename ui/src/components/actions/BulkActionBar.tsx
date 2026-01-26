'use client';

import { useState } from 'react';
import { ExportDialog } from './ExportDialog';
import type { Issue } from '@/lib/types';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIssues: Issue[];
  totalCount: number;
  isProcessing: boolean;
  onProcess: () => void;
  onSelectByFilter?: () => void;
  onClearSelection: () => void;
  className?: string;
}

/**
 * Sticky action bar that appears when items are selected.
 * Provides bulk actions like process, export, and clear selection.
 */
export function BulkActionBar({
  selectedCount,
  selectedIssues,
  totalCount,
  isProcessing,
  onProcess,
  onSelectByFilter,
  onClearSelection,
  className = '',
}: BulkActionBarProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div
        data-testid="bulk-action-bar"
        className={`fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] px-6 py-3 shadow-lg z-40 ${className}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Selection info */}
          <div className="flex items-center gap-4">
            <span className="text-sm">
              <strong>{selectedCount}</strong> of {totalCount} selected
            </span>
            {onSelectByFilter && (
              <button
                onClick={onSelectByFilter}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Select all matching filters
              </button>
            )}
            <button
              data-testid="clear-selection"
              onClick={onClearSelection}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Clear selection
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Export button */}
            <button
              onClick={() => setShowExportDialog(true)}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export
            </button>

            {/* Process button */}
            <button
              data-testid="bulk-process-button"
              onClick={onProcess}
              disabled={isProcessing}
              className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />
                    <path
                      fill="currentColor"
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Process Selected
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        issues={selectedIssues}
      />
    </>
  );
}
