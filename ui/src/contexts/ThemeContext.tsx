'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  /** Current theme setting ('light', 'dark', or 'system') */
  theme: Theme;
  /** The actual applied theme after resolving 'system' preference */
  resolvedTheme: ResolvedTheme;
  /** Set the theme */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
  /** Whether the system preference is being used */
  isSystemPreference: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'meta-ralph-theme';
const THEMES: Theme[] = ['light', 'dark', 'system'];

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextType | null>(null);

// ============================================================================
// Utilities
// ============================================================================

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }
  return 'system';
}

function resolveTheme(theme: Theme, systemPreference: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? systemPreference : theme;
}

// ============================================================================
// Provider
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme to use before hydration */
  defaultTheme?: Theme;
  /** Force a specific theme (for testing) */
  forcedTheme?: ResolvedTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  forcedTheme,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  // Get the resolved theme (actual theme applied)
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (forcedTheme) return forcedTheme;
    return resolveTheme(theme, systemPreference);
  }, [theme, systemPreference, forcedTheme]);

  // Initialize theme from localStorage after mount
  useEffect(() => {
    setMounted(true);
    const storedTheme = getStoredTheme();
    setThemeState(storedTheme);
    setSystemPreference(getSystemPreference());
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Remove both theme classes
    root.classList.remove('light', 'dark');

    // Add the resolved theme class
    root.classList.add(resolvedTheme);

    // Also set a data attribute for CSS selectors
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme, mounted]);

  // Set theme handler
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  // Toggle theme (between light and dark)
  const toggleTheme = useCallback(() => {
    const newTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const contextValue = useMemo<ThemeContextType>(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isSystemPreference: theme === 'system',
  }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access theme context.
 * Must be used within a ThemeProvider.
 *
 * @example
 * const { theme, setTheme, toggleTheme, resolvedTheme } = useTheme();
 *
 * // Toggle between light and dark
 * <button onClick={toggleTheme}>Toggle Theme</button>
 *
 * // Set specific theme
 * <button onClick={() => setTheme('system')}>Use System</button>
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
