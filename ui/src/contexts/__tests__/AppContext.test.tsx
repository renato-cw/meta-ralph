import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../AppContext';
import type { Issue, ProcessingStatus } from '@/lib/types';

// Helper component to test the context
function TestComponent({ testFn }: { testFn?: (ctx: ReturnType<typeof useApp>) => void }) {
  const ctx = useApp();
  testFn?.(ctx);
  return (
    <div>
      <div data-testid="issues-count">{ctx.issues.length}</div>
      <div data-testid="loading">{ctx.loading.toString()}</div>
      <div data-testid="error">{ctx.error || 'no-error'}</div>
      <div data-testid="selected-count">{ctx.selectedIds.size}</div>
      <div data-testid="detail-open">{ctx.isDetailOpen.toString()}</div>
      <div data-testid="processing">{ctx.processing.isProcessing.toString()}</div>
      <div data-testid="search-query">{ctx.searchQuery}</div>
      <div data-testid="filters-active">{ctx.hasActiveFilters.toString()}</div>
      <button data-testid="toggle-btn" onClick={() => ctx.handleToggle('test-1')}>Toggle</button>
      <button data-testid="select-all-btn" onClick={() => ctx.handleSelectAll()}>Select All</button>
      <button data-testid="deselect-all-btn" onClick={() => ctx.handleDeselectAll()}>Deselect All</button>
      <button data-testid="fetch-btn" onClick={() => ctx.fetchIssues()}>Fetch</button>
      <button data-testid="search-btn" onClick={() => ctx.setSearchQuery('test')}>Search</button>
      <button data-testid="clear-search-btn" onClick={() => ctx.clearSearchQuery()}>Clear Search</button>
    </div>
  );
}

// Mock issues for testing
const mockIssues: Issue[] = [
  {
    id: 'test-1',
    provider: 'zeropath',
    title: 'Test Issue 1',
    description: 'Test description 1',
    location: 'src/test.ts',
    severity: 'HIGH',
    raw_severity: 'high',
    count: 5,
    priority: 80,
    permalink: 'https://example.com/1',
    metadata: {},
  },
  {
    id: 'test-2',
    provider: 'sentry',
    title: 'Test Issue 2',
    description: 'Test description 2',
    location: 'src/another.ts',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    count: 3,
    priority: 50,
    permalink: 'https://example.com/2',
    metadata: {},
  },
];

const mockProcessingStatus: ProcessingStatus = {
  isProcessing: false,
  currentIssueId: null,
  logs: [],
  completed: [],
  failed: [],
};

describe('AppContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        issues: mockIssues,
        processing: mockProcessingStatus,
      }),
    });
  });

  describe('Provider', () => {
    it('renders children', async () => {
      render(
        <AppProvider>
          <div data-testid="child">Hello</div>
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child')).toHaveTextContent('Hello');
      });
    });

    it('throws error when useApp is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useApp must be used within an AppProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Issues Management', () => {
    it('fetches issues on mount', async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/issues');
    });

    it('sets loading state during fetch', async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      // After fetch completes
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('handles fetch error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch issues: Not Found');
      });
    });

    it('handles network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Selection State', () => {
    it('toggles issue selection', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      // Initially no selection
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');

      // Toggle selection
      await user.click(screen.getByTestId('toggle-btn'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');

      // Toggle again to deselect
      await user.click(screen.getByTestId('toggle-btn'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    });

    it('selects all issues', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      await user.click(screen.getByTestId('select-all-btn'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    });

    it('deselects all issues', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      // First select all
      await user.click(screen.getByTestId('select-all-btn'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2');

      // Then deselect all
      await user.click(screen.getByTestId('deselect-all-btn'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    });
  });

  describe('Search State', () => {
    it('updates search query', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      expect(screen.getByTestId('search-query')).toHaveTextContent('');

      await user.click(screen.getByTestId('search-btn'));
      expect(screen.getByTestId('search-query')).toHaveTextContent('test');
    });

    it('clears search query', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
      });

      // Set search
      await user.click(screen.getByTestId('search-btn'));
      expect(screen.getByTestId('search-query')).toHaveTextContent('test');

      // Clear search
      await user.click(screen.getByTestId('clear-search-btn'));
      expect(screen.getByTestId('search-query')).toHaveTextContent('');
    });
  });

  describe('Processing State', () => {
    it('initializes with not processing', async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('processing')).toHaveTextContent('false');
      });
    });

    it('processes issues successfully', async () => {
      const user = userEvent.setup();

      // Mock POST response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            issues: mockIssues,
            processing: mockProcessingStatus,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            processing: { ...mockProcessingStatus, isProcessing: true },
          }),
        });

      // Custom component to test processIssues
      function ProcessTestComponent() {
        const ctx = useApp();
        return (
          <div>
            <div data-testid="processing">{ctx.processing.isProcessing.toString()}</div>
            <button data-testid="process-btn" onClick={() => ctx.processIssues(['test-1'])}>Process</button>
          </div>
        );
      }

      render(
        <AppProvider>
          <ProcessTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('processing')).toHaveTextContent('false');
      });

      await user.click(screen.getByTestId('process-btn'));

      expect(global.fetch).toHaveBeenCalledWith('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['test-1'] }),
      });
    });

    it('handles processing error', async () => {
      // Mock POST error response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            issues: mockIssues,
            processing: mockProcessingStatus,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Processing failed' }),
        });

      // Custom component to test processIssues error
      function ProcessErrorTestComponent() {
        const ctx = useApp();
        return (
          <div>
            <div data-testid="error">{ctx.error || 'no-error'}</div>
            <button data-testid="process-btn" onClick={() => ctx.processIssues(['test-1'])}>Process</button>
          </div>
        );
      }

      const user = userEvent.setup();

      render(
        <AppProvider>
          <ProcessErrorTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });

      await user.click(screen.getByTestId('process-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Processing failed');
      });
    });
  });

  describe('Detail Panel', () => {
    it('opens and closes detail panel', async () => {
      // Custom component to test detail panel
      function DetailPanelTestComponent() {
        const ctx = useApp();
        return (
          <div>
            <div data-testid="detail-open">{ctx.isDetailOpen.toString()}</div>
            <div data-testid="detail-issue">{ctx.detailIssue?.id || 'none'}</div>
            <button data-testid="open-btn" onClick={() => ctx.openDetailPanel(mockIssues[0])}>Open</button>
            <button data-testid="close-btn" onClick={() => ctx.closeDetailPanel()}>Close</button>
          </div>
        );
      }

      const user = userEvent.setup();

      render(
        <AppProvider>
          <DetailPanelTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('detail-open')).toHaveTextContent('false');
      });

      // Open panel
      await user.click(screen.getByTestId('open-btn'));
      expect(screen.getByTestId('detail-open')).toHaveTextContent('true');
      expect(screen.getByTestId('detail-issue')).toHaveTextContent('test-1');

      // Close panel
      await user.click(screen.getByTestId('close-btn'));
      expect(screen.getByTestId('detail-open')).toHaveTextContent('false');
    });
  });

  describe('Sort State', () => {
    it('provides sort state from hook', async () => {
      let capturedSort: ReturnType<typeof useApp>['sort'] | null = null;

      function SortTestComponent() {
        const ctx = useApp();
        capturedSort = ctx.sort;
        return (
          <div>
            <div data-testid="sort-field">{ctx.sort.field}</div>
            <div data-testid="sort-direction">{ctx.sort.direction}</div>
            <button data-testid="toggle-sort" onClick={() => ctx.toggleSort('severity')}>Toggle Sort</button>
          </div>
        );
      }

      const user = userEvent.setup();

      render(
        <AppProvider>
          <SortTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedSort).not.toBeNull();
      });

      // Default sort is priority desc
      expect(screen.getByTestId('sort-field')).toHaveTextContent('priority');
      expect(screen.getByTestId('sort-direction')).toHaveTextContent('desc');

      // Toggle to severity
      await user.click(screen.getByTestId('toggle-sort'));
      expect(screen.getByTestId('sort-field')).toHaveTextContent('severity');
    });
  });

  describe('Filter State', () => {
    it('provides filter state from hook', async () => {
      function FilterTestComponent() {
        const ctx = useApp();
        return (
          <div>
            <div data-testid="has-filters">{ctx.hasActiveFilters.toString()}</div>
            <div data-testid="filter-count">{ctx.activeFilterCount}</div>
            <button data-testid="toggle-provider" onClick={() => ctx.toggleProvider('zeropath')}>Toggle Provider</button>
            <button data-testid="clear-filters" onClick={() => ctx.clearFilters()}>Clear Filters</button>
          </div>
        );
      }

      const user = userEvent.setup();

      render(
        <AppProvider>
          <FilterTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('has-filters')).toHaveTextContent('false');
      });

      // Toggle a provider filter
      await user.click(screen.getByTestId('toggle-provider'));
      expect(screen.getByTestId('has-filters')).toHaveTextContent('true');
      expect(screen.getByTestId('filter-count')).toHaveTextContent('1');

      // Clear filters
      await user.click(screen.getByTestId('clear-filters'));
      expect(screen.getByTestId('has-filters')).toHaveTextContent('false');
      expect(screen.getByTestId('filter-count')).toHaveTextContent('0');
    });
  });

  describe('Processed Issues', () => {
    it('filters, searches, and sorts issues', async () => {
      function ProcessedIssuesTestComponent() {
        const ctx = useApp();
        return (
          <div>
            <div data-testid="issues-count">{ctx.issues.length}</div>
            <div data-testid="processed-count">{ctx.processedIssues.length}</div>
            <button data-testid="toggle-provider" onClick={() => ctx.toggleProvider('zeropath')}>Toggle Provider</button>
          </div>
        );
      }

      const user = userEvent.setup();

      render(
        <AppProvider>
          <ProcessedIssuesTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issues-count')).toHaveTextContent('2');
        expect(screen.getByTestId('processed-count')).toHaveTextContent('2');
      });

      // Filter by provider - only zeropath issues
      await user.click(screen.getByTestId('toggle-provider'));
      expect(screen.getByTestId('processed-count')).toHaveTextContent('1');
    });
  });

  describe('Available Providers', () => {
    it('extracts unique providers from issues', async () => {
      function ProvidersTestComponent() {
        const ctx = useApp();
        return (
          <div data-testid="providers">{ctx.availableProviders.join(',')}</div>
        );
      }

      render(
        <AppProvider>
          <ProvidersTestComponent />
        </AppProvider>
      );

      await waitFor(() => {
        const providers = screen.getByTestId('providers').textContent?.split(',');
        expect(providers).toContain('zeropath');
        expect(providers).toContain('sentry');
      });
    });
  });
});

describe('Selector Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        issues: mockIssues,
        processing: mockProcessingStatus,
      }),
    });
  });

  it('useAppIssues returns only issues-related state', async () => {
    const { useAppIssues } = require('../AppContext');

    function IssuesHookTestComponent() {
      const { issues, processedIssues, loading, error, fetchIssues, availableProviders } = useAppIssues();
      return (
        <div>
          <div data-testid="has-issues">{issues !== undefined ? 'yes' : 'no'}</div>
          <div data-testid="has-processed">{processedIssues !== undefined ? 'yes' : 'no'}</div>
          <div data-testid="has-loading">{loading !== undefined ? 'yes' : 'no'}</div>
          <div data-testid="has-error">{error !== undefined || error === null ? 'yes' : 'no'}</div>
          <div data-testid="has-fetch">{fetchIssues !== undefined ? 'yes' : 'no'}</div>
          <div data-testid="has-providers">{availableProviders !== undefined ? 'yes' : 'no'}</div>
        </div>
      );
    }

    render(
      <AppProvider>
        <IssuesHookTestComponent />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-issues')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-processed')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-loading')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-error')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-fetch')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-providers')).toHaveTextContent('yes');
    });
  });
});
