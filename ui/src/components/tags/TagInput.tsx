'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Tag } from '@/lib/types';
import { TAG_COLORS } from '@/lib/types';
import { TagBadge } from './TagBadge';

interface TagInputProps {
  /** All available tags */
  availableTags: Tag[];
  /** Tags currently assigned to the issue */
  selectedTags: Tag[];
  /** Callback when a tag is added */
  onAddTag: (tag: Tag) => void;
  /** Callback when a tag is removed */
  onRemoveTag: (tagId: string) => void;
  /** Callback when a new tag needs to be created */
  onCreateTag?: (name: string, color: string) => Tag;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Tag input with autocomplete and inline tag creation.
 *
 * @example
 * <TagInput
 *   availableTags={tags}
 *   selectedTags={issueTags}
 *   onAddTag={handleAddTag}
 *   onRemoveTag={handleRemoveTag}
 *   onCreateTag={handleCreateTag}
 * />
 */
export function TagInput({
  availableTags,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  placeholder = 'Add tags...',
  disabled = false,
  className = '',
}: TagInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter available tags based on query and exclude already selected
  const filteredTags = availableTags.filter((tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);
    if (isSelected) return false;
    if (!query) return true;
    return tag.name.toLowerCase().includes(query.toLowerCase());
  });

  // Check if query matches exactly an existing tag name
  const exactMatch = availableTags.find(
    (tag) => tag.name.toLowerCase() === query.toLowerCase()
  );

  // Check if we can create a new tag
  const canCreate = onCreateTag && query.trim() && !exactMatch;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered tags change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTags.length]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setShowColorPicker(false);
  }, []);

  const handleSelectTag = useCallback((tag: Tag) => {
    onAddTag(tag);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onAddTag]);

  const handleCreateTag = useCallback(() => {
    if (!onCreateTag || !query.trim()) return;

    if (showColorPicker) {
      const newTag = onCreateTag(query.trim(), newTagColor);
      onAddTag(newTag);
      setQuery('');
      setIsOpen(false);
      setShowColorPicker(false);
      inputRef.current?.focus();
    } else {
      setShowColorPicker(true);
    }
  }, [onCreateTag, query, showColorPicker, newTagColor, onAddTag]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) => {
          const maxIndex = filteredTags.length + (canCreate ? 1 : 0) - 1;
          return Math.min(prev + 1, maxIndex);
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (showColorPicker) {
          handleCreateTag();
        } else if (highlightedIndex < filteredTags.length) {
          handleSelectTag(filteredTags[highlightedIndex]);
        } else if (canCreate) {
          handleCreateTag();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setShowColorPicker(false);
        break;
      case 'Backspace':
        if (!query && selectedTags.length > 0) {
          onRemoveTag(selectedTags[selectedTags.length - 1].id);
        }
        break;
    }
  }, [isOpen, filteredTags, highlightedIndex, canCreate, showColorPicker, handleSelectTag, handleCreateTag, query, selectedTags, onRemoveTag]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5
          ${disabled ? 'bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}
          border-gray-300 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500`}
      >
        {/* Selected tags */}
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="sm"
            onRemove={disabled ? undefined : () => onRemoveTag(tag.id)}
          />
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          aria-label="Add tag"
          aria-expanded={isOpen}
          aria-controls="tag-listbox"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (filteredTags.length > 0 || canCreate) && (
        <div
          id="tag-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {/* Existing tags */}
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              role="option"
              aria-selected={highlightedIndex === index}
              onClick={() => handleSelectTag(tag)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                ${highlightedIndex === index ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-gray-900 dark:text-gray-100">{tag.name}</span>
            </button>
          ))}

          {/* Create new tag option */}
          {canCreate && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                role="option"
                aria-selected={highlightedIndex === filteredTags.length}
                onClick={handleCreateTag}
                onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                  ${highlightedIndex === filteredTags.length ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">
                  Create &quot;{query.trim()}&quot;
                </span>
              </button>

              {/* Color picker for new tag */}
              {showColorPicker && (
                <div className="flex flex-wrap gap-1 border-t border-gray-200 p-2 dark:border-gray-700">
                  <span className="mb-1 w-full text-xs text-gray-500">Select color:</span>
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setNewTagColor(color);
                        const newTag = onCreateTag!(query.trim(), color);
                        onAddTag(newTag);
                        setQuery('');
                        setIsOpen(false);
                        setShowColorPicker(false);
                        inputRef.current?.focus();
                      }}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110
                        ${newTagColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
