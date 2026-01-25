import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/contexts';
import { ThemeToggle } from '../ThemeToggle';

// Mock matchMedia
const mockMatchMedia = (prefersDark: boolean) => {
  return Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('ThemeToggle', () => {
  const originalLocalStorage = window.localStorage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

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

    mockMatchMedia(true); // Default to dark system preference

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  const renderWithTheme = (showDropdown = false) => {
    return render(
      <ThemeProvider>
        <ThemeToggle showDropdown={showDropdown} />
      </ThemeProvider>
    );
  };

  describe('toggle button mode (default)', () => {
    it('should render a toggle button', async () => {
      renderWithTheme();

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    it('should have accessible label', async () => {
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', expect.stringContaining('Switch to'));
      });
    });

    it('should show sun icon when in dark mode (to switch to light)', async () => {
      mockStorage['meta-ralph-theme'] = 'dark';
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        // Button should indicate it will switch to light
        expect(button).toHaveAttribute('aria-label', 'Switch to light theme');
      });
    });

    it('should show moon icon when in light mode (to switch to dark)', async () => {
      mockStorage['meta-ralph-theme'] = 'light';
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
      });
    });

    it('should toggle theme when clicked', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'dark';
      renderWithTheme();

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light theme');
      });

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark theme');
      });
    });

    it('should have title with current theme info', async () => {
      mockStorage['meta-ralph-theme'] = 'dark';
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('title', expect.stringContaining('Current: dark'));
      });
    });

    it('should indicate system preference in title when using system theme', async () => {
      mockStorage['meta-ralph-theme'] = 'system';
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('title', expect.stringContaining('system preference'));
      });
    });

    it('should indicate manual setting in title when using explicit theme', async () => {
      mockStorage['meta-ralph-theme'] = 'light';
      renderWithTheme();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('title', expect.stringContaining('manual'));
      });
    });

    it('should apply custom className', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle className="custom-class" />
        </ThemeProvider>
      );

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveClass('custom-class');
      });
    });
  });

  describe('dropdown mode', () => {
    it('should render a select dropdown', async () => {
      renderWithTheme(true);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should have accessible label', async () => {
      renderWithTheme(true);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-label', 'Select theme');
      });
    });

    it('should show all theme options', async () => {
      renderWithTheme(true);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'System' })).toBeInTheDocument();
      });
    });

    it('should have correct value based on current theme', async () => {
      mockStorage['meta-ralph-theme'] = 'light';
      renderWithTheme(true);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('light');
      });
    });

    it('should change theme when selecting option', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'dark';
      renderWithTheme(true);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('dark');
      });

      await user.selectOptions(screen.getByRole('combobox'), 'light');

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('light');
      });
      expect(mockStorage['meta-ralph-theme']).toBe('light');
    });

    it('should allow setting system theme', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'light';
      renderWithTheme(true);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('light');
      });

      await user.selectOptions(screen.getByRole('combobox'), 'system');

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('system');
      });
    });

    it('should apply custom className to wrapper', async () => {
      render(
        <ThemeProvider>
          <ThemeToggle showDropdown className="custom-class" />
        </ThemeProvider>
      );

      await waitFor(() => {
        const wrapper = screen.getByRole('combobox').closest('div');
        expect(wrapper).toHaveClass('custom-class');
      });
    });
  });

  describe('integration', () => {
    it('should persist theme changes to localStorage', async () => {
      const user = userEvent.setup();
      renderWithTheme();

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button'));

      expect(localStorage.setItem).toHaveBeenCalledWith('meta-ralph-theme', expect.any(String));
    });

    it('should update document theme class', async () => {
      const user = userEvent.setup();
      mockStorage['meta-ralph-theme'] = 'dark';
      renderWithTheme();

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });
  });
});
