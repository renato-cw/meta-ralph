'use client';

import { useState, useRef, useEffect } from 'react';
import { ExportDialog } from './ExportDialog';
import { TagBadge } from '@/components/tags';
import { useTags } from '@/hooks';
import type { Issue, Tag } from '@/lib/types';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIssues: Issue[];
  totalCount: number;
  isProcessing: boolean;
  onProcess: () => void;
  onSelectByFilter?: () => void;
  onClearSelection: () => void;
  className?: string;
  /** Hide the bar (e.g., when processing queue panel is open) */
  hidden?: boolean;
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
  hidden = false,
}: BulkActionBarProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const { tags, bulkAddTags, bulkRemoveTags, getIssueTags } = useTags();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };

    if (showTagDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagDropdown]);

  // Get common tags across all selected issues
  const selectedIds = selectedIssues.map(i => i.id);
  const getCommonTags = (): Tag[] => {
    if (selectedIds.length === 0) return [];
    const firstIssueTags = getIssueTags(selectedIds[0]);
    return firstIssueTags.filter(tag =>
      selectedIds.every(id => getIssueTags(id).some(t => t.id === tag.id))
    );
  };
  const commonTags = getCommonTags();

  const handleAddTag = (tagId: string) => {
    bulkAddTags(selectedIds, [tagId]);
  };

  const handleRemoveTag = (tagId: string) => {
    bulkRemoveTags(selectedIds, [tagId]);
  };

  if (selectedCount === 0 || hidden) {
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
            {/* Tag button with dropdown */}
            <div className="relative" ref={tagDropdownRef}>
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                Tags
                {commonTags.length > 0 && (
                  <span className="text-xs bg-[var(--primary)] text-white px-1.5 rounded-full">
                    {commonTags.length}
                  </span>
                )}
              </button>

              {/* Tag dropdown */}
              {showTagDropdown && (
                <div className="absolute bottom-full mb-2 right-0 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* Common tags section (if any) */}
                  {commonTags.length > 0 && (
                    <div className="p-3 border-b border-[var(--border)]">
                      <p className="text-xs text-[var(--muted)] mb-2">Common tags (click to remove)</p>
                      <div className="flex flex-wrap gap-1">
                        {commonTags.map((tag) => (
                          <TagBadge
                            key={tag.id}
                            tag={tag}
                            size="sm"
                            onRemove={() => handleRemoveTag(tag.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available tags section */}
                  <div className="p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs text-[var(--muted)] mb-2">Add tag to selected</p>
                    {tags.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">No tags created yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tags
                          .filter(tag => !commonTags.some(ct => ct.id === tag.id))
                          .map((tag) => (
                            <TagBadge
                              key={tag.id}
                              tag={tag}
                              size="sm"
                              onClick={() => handleAddTag(tag.id)}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
