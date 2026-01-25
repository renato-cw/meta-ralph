'use client';

import { useEffect, useCallback } from 'react';
import {
  getShortcutsByCategory,
  formatShortcutKey,
  CATEGORY_NAMES,
} from '@/lib/shortcuts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal dialog showing all available keyboard shortcuts.
 *
 * Press '?' to open this modal, Escape to close it.
 */
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const categories = getShortcutsByCategory();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(categories).map(([category, shortcuts]) => (
              shortcuts.length > 0 && (
                <div key={category}>
                  <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-3">
                    {CATEGORY_NAMES[category]}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm text-[var(--foreground)]">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded">
                          {formatShortcutKey(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted)]">
              Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded">Esc</kbd> to close this dialog.
              Shortcuts are disabled when typing in input fields.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
