'use client';

import { ThemeToggle } from '@/components/common';

/**
 * Application header component.
 * Client component that includes the theme toggle.
 */
export function Header() {
  return (
    <header className="border-b border-[var(--border)] px-6 py-4 bg-[var(--background)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Meta-Ralph
          </h1>
          <span className="text-sm text-[var(--muted)]">
            Unified Issue Resolution Agent
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle showDropdown />
        </div>
      </div>
    </header>
  );
}
