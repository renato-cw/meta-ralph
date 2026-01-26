import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock matchMedia
const mockMatchMedia = (prefersDark: boolean) => {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  return Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        const idx = listeners.indexOf(cb);
        if (idx > -1) listeners.splice(idx, 1);
      },
      dispatchEvent: jest.fn(),
      // For testing system preference changes
      _simulateChange: (matches: boolean) => {
        listeners.forEach(cb => cb({ matches }));
      },
    })),
  });
};

// Test component that displays theme state
function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme, toggleTheme, isSystemPreference } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <span data-testid="is-system">{isSystemPreference.toString()}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe('ThemeContext', () => {
  const originalLocalStorage = window.localStorage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Reset mock storage
    mockStorage = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: jest.fn(() => {
          mockStorage = {};
        }),
      },
      writable: true,
    });

    // Mock matchMedia to prefer dark by default
    mockMatchMedia(true);

    // Reset document classes
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe('initialization', () => {
    it('should default to system theme', async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
      });
      expect(screen.getByTestId('is-system')).toHaveTextContent('true');
    });

    it('should resolve system theme to dark when system prefers dark', async () => {
      mockMatchMedia(true); // System prefers dark

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });

    it('should resolve system theme to light when system prefers light', async () => {
      mockMatchMedia(false); // System prefers light

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });
    });

    it('should load theme from localStorage on mount', async () => {
      mockStorage['meta-ralph-theme'] = 'light';

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    });

    it('should use defaultTheme for initial render then load from storage', async () => {
      // When localStorage is empty, after mount it defaults to 'system'
      // The defaultTheme prop is for SSR/initial render before useEffect
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeConsumer />
        </ThemeProvider>
      );

      // After mount and useEffect, loads from storage (empty = 'system')
      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
      });
    });

    it('should use forcedTheme when provided', async () => {
      mockMatchMedia(true); // System prefers dark

      render(
        <ThemeProvider forcedTheme="light">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByText('Set Light'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('is-system')).toHaveTextContent('false');
      expect(mockStorage['meta-ralph-theme']).toBe('light');
    });

    it('should set theme to dark', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByText('Set Dark'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('is-system')).toHaveTextContent('false');
    });

    it('should set theme to system', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'light';

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });

      await user.click(screen.getByText('Set System'));

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
      });
      expect(screen.getByTestId('is-system')).toHaveTextContent('true');
    });

    it('should persist theme to localStorage', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByText('Set Light'));

      expect(localStorage.setItem).toHaveBeenCalledWith('meta-ralph-theme', 'light');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'dark';

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });

      await user.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });
    });

    it('should toggle from light to dark', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'light';

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });

      await user.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });

    it('should respect system preference when toggling from system theme', async () => {
      const user = userEvent.setup();
      mockMatchMedia(true); // System prefers dark

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      // Initially system (which resolves to dark)
      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });

      // Toggle should go to light
      await user.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });
    });
  });

  describe('document class updates', () => {
    it('should add dark class to document when theme is dark', async () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should add light class to document when theme is light', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByText('Set Light'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should set data-theme attribute', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByText('Set Light'));

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when useTheme is used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ThemeConsumer />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});
