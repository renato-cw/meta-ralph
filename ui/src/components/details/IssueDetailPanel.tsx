'use client';

import { useEffect, useCallback } from 'react';
import type { Issue, Severity } from '@/lib/types';
import { IssueMetadata } from './IssueMetadata';
import { CodeSnippet } from './CodeSnippet';

interface IssueDetailPanelProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onProcess?: (id: string) => void;
  isProcessing?: boolean;
}

// Helper to safely get a string from metadata
function getMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' ? value : null;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: 'bg-red-900/50 text-red-300 border-red-700',
  HIGH: 'bg-orange-900/50 text-orange-300 border-orange-700',
  MEDIUM: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  LOW: 'bg-green-900/50 text-green-300 border-green-700',
  INFO: 'bg-blue-900/50 text-blue-300 border-blue-700',
};

/**
 * Slide-out panel showing full issue details.
 * Opens from the right side of the screen.
 */
export function IssueDetailPanel({
  issue,
  isOpen,
  onClose,
  onProcess,
  isProcessing,
}: IssueDetailPanelProps) {
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !issue) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        data-testid="issue-detail-panel"
        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[var(--card)] border-l border-[var(--border)] shadow-xl z-50 overflow-y-auto animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--background)]">
                  {issue.provider}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded border ${SEVERITY_COLORS[issue.severity]}`}>
                  {issue.severity}
                </span>
              </div>
              <h2 id="panel-title" className="text-lg font-semibold break-words">
                {issue.title}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1 font-mono">
                {issue.id}
              </p>
            </div>
            <button
              data-testid="detail-close"
              onClick={onClose}
              className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Metrics */}
          <section>
            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--primary)]">{issue.priority}</div>
                <div className="text-xs text-[var(--muted)]">Priority</div>
              </div>
              <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{issue.count}</div>
                <div className="text-xs text-[var(--muted)]">Count</div>
              </div>
              <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{issue.raw_severity}</div>
                <div className="text-xs text-[var(--muted)]">Raw Score</div>
              </div>
            </div>
          </section>

          {/* Description */}
          <section>
            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
          </section>

          {/* Location */}
          {issue.location && (
            <section>
              <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Location</h3>
              <div className="bg-[var(--background)] rounded-lg p-3 font-mono text-sm break-all">
                {issue.location}
              </div>
            </section>
          )}

          {/* Code Snippet (if available in metadata) */}
          {getMetadataString(issue.metadata, 'codeSnippet') && (
            <section>
              <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Code Snippet</h3>
              <CodeSnippet code={getMetadataString(issue.metadata, 'codeSnippet')!} />
            </section>
          )}

          {/* Provider-specific metadata */}
          <section>
            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Details</h3>
            <IssueMetadata metadata={issue.metadata} provider={issue.provider} />
          </section>

          {/* Actions */}
          <section className="pt-4 border-t border-[var(--border)]">
            <div className="flex flex-wrap gap-3">
              {onProcess && (
                <button
                  onClick={() => onProcess(issue.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Process Issue
                    </>
                  )}
                </button>
              )}

              <a
                href={issue.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Original
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(issue.permalink);
                }}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-2"
                title="Copy link to clipboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </section>
        </div>
      </div>

    </>
  );
}
