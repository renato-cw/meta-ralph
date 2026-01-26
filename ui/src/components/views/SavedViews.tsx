'use client';

import { useState, useRef, useEffect } from 'react';
import type { SavedView } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

interface SavedViewsProps {
  /** List of saved views */
  views: SavedView[];
  /** Currently active view (if any) */
  activeView: SavedView | null;
  /** Callback when a view is selected */
  onSelectView: (id: string) => void;
  /** Callback when save button is clicked */
  onSaveClick: () => void;
  /** Callback to delete a view */
  onDeleteView: (id: string) => void;
  /** Callback to set a view as default */
  onSetDefault: (id: string | null) => void;
  /** Callback to rename a view */
  onRenameView: (id: string, newName: string) => void;
  /** Callback to duplicate a view */
  onDuplicateView: (id: string) => void;
  /** Whether the current state matches the active view */
  hasUnsavedChanges?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dropdown component for managing saved filter/sort views.
 *
 * Shows a list of saved views with options to load, rename, delete,
 * set as default, or duplicate. Also provides a button to save the
 * current state as a new view.
 */
export function SavedViews({
  views,
  activeView,
  onSelectView,
  onSaveClick,
  onDeleteView,
  onSetDefault,
  onRenameView,
  onDuplicateView,
  hasUnsavedChanges,
  className = '',
}: SavedViewsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setMenuOpenId(null);
        setEditingId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (view: SavedView) => {
    setEditingId(view.id);
    setEditName(view.name);
    setMenuOpenId(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameView(editingId, editName.trim());
      setEditingId(null);
      setEditName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--card)] rounded-md hover:border-[var(--primary)] transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <svg
          className="w-4 h-4 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <span className="text-[var(--foreground)]">
          {activeView ? activeView.name : 'Saved Views'}
        </span>
        {hasUnsavedChanges && activeView && (
          <span className="text-[var(--warning)]" title="Unsaved changes">*</span>
        )}
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg">
          {/* Header with save button */}
          <div className="flex items-center justify-between p-2 border-b border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Saved Views ({views.length})
            </span>
            <button
              type="button"
              onClick={() => {
                onSaveClick();
                setIsOpen(false);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save Current
            </button>
          </div>

          {/* Views list */}
          <div className="max-h-64 overflow-y-auto">
            {views.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--muted)]">
                No saved views yet.
                <br />
                <span className="text-xs">Click &quot;Save Current&quot; to create one.</span>
              </div>
            ) : (
              <ul role="listbox">
                {views.map((view) => (
                  <li
                    key={view.id}
                    className={`relative group ${
                      activeView?.id === view.id
                        ? 'bg-[var(--primary)] bg-opacity-10'
                        : 'hover:bg-[var(--background)]'
                    }`}
                  >
                    {editingId === view.id ? (
                      // Edit mode
                      <div className="flex items-center gap-2 p-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          className="flex-1 px-2 py-1 text-sm bg-[var(--input)] text-[var(--foreground)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          placeholder="View name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="p-1 text-[var(--success)] hover:bg-[var(--border)] rounded"
                          title="Save"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1 text-[var(--danger)] hover:bg-[var(--border)] rounded"
                          title="Cancel"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      // Normal mode
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectView(view.id);
                            setIsOpen(false);
                          }}
                          className="flex-1 flex items-center gap-2 p-2 text-left"
                          role="option"
                          aria-selected={activeView?.id === view.id}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-[var(--foreground)] truncate">
                                {view.name}
                              </span>
                              {view.isDefault && (
                                <span className="px-1 py-0.5 text-xs bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--muted)]">
                              Updated {formatDate(view.updatedAt)}
                            </span>
                          </div>
                          {activeView?.id === view.id && (
                            <svg className="w-4 h-4 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Actions menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === view.id ? null : view.id);
                            }}
                            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="More options"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>

                          {menuOpenId === view.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg z-10">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(view)}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDuplicateView(view.id);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onSetDefault(view.isDefault ? null : view.id);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                              >
                                {view.isDefault ? 'Unset Default' : 'Set as Default'}
                              </button>
                              <div className="border-t border-[var(--border)]" />
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteView(view.id);
                                  setMenuOpenId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger)] hover:bg-opacity-10"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
