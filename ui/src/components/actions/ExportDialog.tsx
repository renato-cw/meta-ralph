'use client';

import { useState } from 'react';
import { exportIssues, getExportableFields, type ExportFormat } from '@/lib/export';
import type { Issue } from '@/lib/types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issues: Issue[];
}

/**
 * Dialog for configuring and executing export.
 */
export function ExportDialog({ isOpen, onClose, issues }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedFields, setSelectedFields] = useState<Set<keyof Issue>>(
    new Set(['id', 'provider', 'title', 'severity', 'priority', 'count', 'location', 'permalink'])
  );

  const exportableFields = getExportableFields();

  const handleToggleField = (field: keyof Issue) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFields(new Set(exportableFields.map((f) => f.field)));
  };

  const handleDeselectAll = () => {
    setSelectedFields(new Set());
  };

  const handleExport = () => {
    exportIssues(issues, {
      format,
      fields: Array.from(selectedFields),
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold">Export Issues</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Exporting {issues.length} issue{issues.length !== 1 ? 's' : ''}
          </p>

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="w-4 h-4"
                />
                <span className="text-sm">CSV</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="w-4 h-4"
                />
                <span className="text-sm">JSON</span>
              </label>
            </div>
          </div>

          {/* Field selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Fields to include</label>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="text-[var(--primary)] hover:underline"
                >
                  Select all
                </button>
                <span className="text-[var(--muted)]">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {exportableFields.map(({ field, label }) => (
                <label
                  key={field}
                  className="flex items-center gap-2 cursor-pointer hover:bg-[var(--border)] px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field)}
                    onChange={() => handleToggleField(field)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
