'use client';

import { useState, useCallback } from 'react';
import type { Tag } from '@/lib/types';
import { TAG_COLORS } from '@/lib/types';
import { TagBadge } from './TagBadge';

interface TagManagerProps {
  tags: Tag[];
  tagUsageCounts: Record<string, number>;
  onCreateTag: (name: string, color: string) => Tag;
  onUpdateTag: (id: string, updates: Partial<Omit<Tag, 'id'>>) => void;
  onDeleteTag: (id: string) => void;
  onExport: () => string;
  onImport: (jsonString: string) => number;
  onClearAll: () => void;
}

/**
 * Tag manager component for creating, editing, and deleting tags.
 *
 * @example
 * <TagManager
 *   tags={tags}
 *   tagUsageCounts={counts}
 *   onCreateTag={createTag}
 *   onUpdateTag={updateTag}
 *   onDeleteTag={deleteTag}
 *   onExport={exportTags}
 *   onImport={importTags}
 *   onClearAll={clearAll}
 * />
 */
export function TagManager({
  tags,
  tagUsageCounts,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onExport,
  onImport,
  onClearAll,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCreateTag = useCallback(() => {
    if (!newTagName.trim()) return;

    onCreateTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
  }, [newTagName, newTagColor, onCreateTag]);

  const handleStartEdit = useCallback((tag: Tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTag || !editName.trim()) return;

    onUpdateTag(editingTag, { name: editName.trim(), color: editColor });
    setEditingTag(null);
  }, [editingTag, editName, editColor, onUpdateTag]);

  const handleCancelEdit = useCallback(() => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  }, []);

  const handleExport = useCallback(() => {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-ralph-tags-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [onExport]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const count = onImport(content);
        alert(`Successfully imported ${count} tags`);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to import tags');
      }
    };
    reader.readAsText(file);

    // Reset the input
    e.target.value = '';
  }, [onImport]);

  const handleClearAll = useCallback(() => {
    onClearAll();
    setShowConfirmClear(false);
  }, [onClearAll]);

  return (
    <div className="space-y-6">
      {/* Create new tag */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Create New Tag
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateTag();
              }
            }}
            placeholder="Tag name..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex gap-1">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewTagColor(color)}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  newTagColor === color
                    ? 'border-gray-900 dark:border-white'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreateTag}
            disabled={!newTagName.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      {/* Tag list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Existing Tags ({tags.length})
        </h3>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tags created yet.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-md border border-gray-200 p-2 dark:border-gray-700"
              >
                {editingTag === tag.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditColor(color)}
                          className={`h-5 w-5 rounded-full border-2 ${
                            editColor === color
                              ? 'border-gray-900 dark:border-white'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <TagBadge tag={tag} size="md" />
                      <span className="text-xs text-gray-500">
                        ({tagUsageCounts[tag.id] || 0} issues)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tag)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                        aria-label={`Edit tag ${tag.name}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTag(tag.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import/Export actions */}
      <div className="flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="button"
          onClick={handleExport}
          disabled={tags.length === 0}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Export Tags
        </button>
        <label className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          Import Tags
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
        {tags.length > 0 && (
          <>
            {showConfirmClear ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-red-600">Delete all tags?</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                className="ml-auto text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </>
        )}
      </div>
      {importError && (
        <p className="text-sm text-red-600">{importError}</p>
      )}
    </div>
  );
}
