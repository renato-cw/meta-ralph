'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { SearchScope } from '@/hooks/useSearch';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  history?: string[];
  onSelectHistory?: (item: string) => void;
  onRemoveHistory?: (item: string) => void;
  placeholder?: string;
  className?: string;
}

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'location', label: 'Location' },
  { value: 'id', label: 'ID (exact)' },
];

/**
 * SearchBar component with scope selector, history dropdown, and keyboard shortcuts.
 * Press `/` anywhere to focus the search bar.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  scope = 'all',
  onScopeChange,
  history = [],
  onSelectHistory,
  onRemoveHistory,
  placeholder = 'Search issues...',
  className = '',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showScopeMenu, setShowScopeMenu] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Global keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // `/` to focus search (when not in an input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (historyIndex >= 0 && historyIndex < history.length) {
          onSelectHistory?.(history[historyIndex]);
          setHistoryIndex(-1);
        } else {
          onSubmit?.();
        }
        setShowHistory(false);
        break;

      case 'Escape':
        e.preventDefault();
        if (showHistory) {
          setShowHistory(false);
          setHistoryIndex(-1);
        } else if (value) {
          onClear?.();
        } else {
          inputRef.current?.blur();
        }
        break;

      case 'ArrowDown':
        if (showHistory && history.length > 0) {
          e.preventDefault();
          setHistoryIndex((prev) => Math.min(prev + 1, history.length - 1));
        }
        break;

      case 'ArrowUp':
        if (showHistory && history.length > 0) {
          e.preventDefault();
          setHistoryIndex((prev) => Math.max(prev - 1, -1));
        }
        break;
    }
  };

  const handleFocus = () => {
    if (history.length > 0 && !value) {
      setShowHistory(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on history item
    setTimeout(() => {
      setShowHistory(false);
      setShowScopeMenu(false);
      setHistoryIndex(-1);
    }, 150);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Scope selector */}
        {onScopeChange && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowScopeMenu(!showScopeMenu)}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--card)] hover:bg-[var(--border)] transition-colors flex items-center gap-1"
            >
              <span className="text-[var(--muted)]">in:</span>
              <span>{SCOPE_OPTIONS.find((s) => s.value === scope)?.label}</span>
              <svg
                className="w-4 h-4 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showScopeMenu && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-20 min-w-[120px]">
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onScopeChange(option.value);
                      setShowScopeMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--border)] transition-colors ${
                      scope === option.value ? 'text-[var(--primary)]' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="w-full pl-10 pr-20 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-colors"
          />

          {/* Clear button and keyboard hint */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onClear?.();
                  inputRef.current?.focus();
                }}
                className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded">
              /
            </kbd>
          </div>
        </div>
      </div>

      {/* Search history dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-10">
          <div className="px-3 py-1 text-xs text-[var(--muted)] border-b border-[var(--border)]">
            Recent searches
          </div>
          {history.map((item, index) => (
            <div
              key={item}
              className={`flex items-center justify-between px-3 py-1.5 hover:bg-[var(--border)] transition-colors cursor-pointer ${
                index === historyIndex ? 'bg-[var(--border)]' : ''
              }`}
              onClick={() => {
                onSelectHistory?.(item);
                setShowHistory(false);
              }}
            >
              <span className="text-sm truncate">{item}</span>
              {onRemoveHistory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveHistory(item);
                  }}
                  className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
