'use client';

import { useState, useEffect, useCallback } from 'react';

interface PlanViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  issueTitle?: string;
  onExecuteBuild?: () => void;
}

/**
 * Modal to display the IMPLEMENTATION_PLAN.md content for a plan mode issue.
 * Provides options to view the plan and execute build mode.
 */
export function PlanViewerModal({
  isOpen,
  onClose,
  issueId,
  issueTitle,
  onExecuteBuild,
}: PlanViewerModalProps) {
  const [planContent, setPlanContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan content when modal opens
  useEffect(() => {
    if (!isOpen || !issueId) return;

    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/plan/${encodeURIComponent(issueId)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || data.error || 'Failed to fetch plan');
          return;
        }

        setPlanContent(data.content);
      } catch (err) {
        setError(`Failed to fetch plan: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [isOpen, issueId]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-center justify-center">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-blue-400">📋</span>
                Implementation Plan
              </h2>
              {issueTitle && (
                <p className="text-sm text-[var(--muted)] mt-0.5 truncate max-w-md">
                  {issueTitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
                <span className="ml-3 text-[var(--muted)]">Loading plan...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-medium text-red-400">Plan Not Found</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {planContent && !loading && (
              <div className="prose prose-invert max-w-none">
                <pre className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap font-mono">
                  {planContent}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--background)]">
            <span className="text-xs text-[var(--muted)]">
              Press <kbd className="px-1.5 py-0.5 font-mono bg-[var(--card)] border border-[var(--border)] rounded">ESC</kbd> to close
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                Close
              </button>
              {onExecuteBuild && planContent && (
                <button
                  onClick={() => {
                    onClose();
                    onExecuteBuild();
                  }}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🔨</span>
                  Execute Build
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
