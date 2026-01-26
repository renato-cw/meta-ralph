'use client';

import { useTheme, type Theme } from '@/contexts';

interface ThemeToggleProps {
  /** Show theme dropdown with system option instead of simple toggle */
  showDropdown?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Theme toggle button component.
 *
 * By default, shows a simple toggle button that cycles between light and dark.
 * With showDropdown=true, shows a dropdown menu with light/dark/system options.
 *
 * @example
 * // Simple toggle
 * <ThemeToggle />
 *
 * // With dropdown
 * <ThemeToggle showDropdown />
 */
export function ThemeToggle({ showDropdown = false, className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (showDropdown) {
    return (
      <div className={`relative ${className}`}>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="appearance-none bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] px-3 py-1.5 pr-8 rounded-md text-sm cursor-pointer hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Select theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-4 h-4 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--input)] hover:border-[var(--primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${className}`}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Current: ${resolvedTheme} (${theme === 'system' ? 'system preference' : 'manual'})`}
    >
      {resolvedTheme === 'dark' ? (
        // Sun icon for switching to light
        <svg
          className="w-5 h-5 text-[var(--foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        // Moon icon for switching to dark
        <svg
          className="w-5 h-5 text-[var(--foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
