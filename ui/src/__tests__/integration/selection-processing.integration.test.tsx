// @ts-nocheck
/**
 * Integration tests for Selection + Processing workflow
 *
 * Tests the complete workflow of selecting issues and interacting with them.
 */
import { render, waitFor, act } from '@testing-library/react';
import { AppProvider, useApp, type AppContextType } from '@/contexts/AppContext';
import type { Issue } from '@/lib/types';

// Mock issues for testing
const mockIssues: Issue[] = [
  {
    id: 'issue-1',
    provider: 'zeropath',
    title: 'Critical vulnerability',
    description: 'Security issue',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    priority: 95,
    count: 5,
    location: 'src/auth/login.ts:45',
    permalink: 'https://example.com/issue/1',
    metadata: {},
  },
  {
    id: 'issue-2',
    provider: 'zeropath',
    title: 'High priority bug',
    description: 'Memory leak',
    severity: 'HIGH',
    raw_severity: 'high',
    priority: 75,
    count: 3,
    location: 'src/services/cache.ts:120',
    permalink: 'https://example.com/issue/2',
    metadata: {},
  },
  {
    id: 'issue-3',
    provider: 'sentry',
    title: 'Medium error',
    description: 'Unhandled exception',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    priority: 50,
    count: 10,
    location: 'src/api/handler.ts:89',
    permalink: 'https://example.com/issue/3',
    metadata: {},
  },
];

// Mock fetch globally
beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    if (options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Processing started',
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ issues: mockIssues }),
    });
  }) as jest.Mock;
});

afterEach(() => {
  jest.resetAllMocks();
});

// Test component that exposes context values
function TestConsumer({ onRender }: { onRender: (ctx: AppContextType) => void }) {
  const ctx = useApp();
  onRender(ctx);
  return (
    <div>
      <div data-testid="selected-count">{ctx.selectedIds.size}</div>
      <div data-testid="issue-count">{ctx.issues.length}</div>
    </div>
  );
}

describe('Selection + Processing Integration', () => {
  describe('Selection Management', () => {
    it('starts with no selections', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      expect(capturedCtx?.selectedIds.size).toBe(0);
    });

    it('toggles individual issue selection', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Select first issue
      act(() => {
        capturedCtx?.handleToggle('issue-1');
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.has('issue-1')).toBe(true);
        expect(capturedCtx?.selectedIds.size).toBe(1);
      });

      // Toggle again to deselect
      act(() => {
        capturedCtx?.handleToggle('issue-1');
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.has('issue-1')).toBe(false);
        expect(capturedCtx?.selectedIds.size).toBe(0);
      });
    });

    it('selects multiple issues', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Select multiple issues
      act(() => {
        capturedCtx?.handleToggle('issue-1');
        capturedCtx?.handleToggle('issue-2');
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(2);
        expect(capturedCtx?.selectedIds.has('issue-1')).toBe(true);
        expect(capturedCtx?.selectedIds.has('issue-2')).toBe(true);
      });
    });

    it('selects all visible issues', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Select all
      act(() => {
        capturedCtx?.handleSelectAll();
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(3);
      });
    });

    it('deselects all issues', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Select all first
      act(() => {
        capturedCtx?.handleSelectAll();
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(3);
      });

      // Deselect all
      act(() => {
        capturedCtx?.handleDeselectAll();
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(0);
      });
    });

    it('select all only selects visible (filtered) issues', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Filter to zeropath only
      act(() => {
        capturedCtx?.toggleProvider('zeropath');
      });

      await waitFor(() => {
        expect(capturedCtx?.processedIssues).toHaveLength(2);
      });

      // Select all (should only select filtered issues)
      act(() => {
        capturedCtx?.handleSelectAll();
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(2);
        expect(capturedCtx?.selectedIds.has('issue-1')).toBe(true);
        expect(capturedCtx?.selectedIds.has('issue-2')).toBe(true);
        expect(capturedCtx?.selectedIds.has('issue-3')).toBe(false);
      });
    });
  });

  describe('Selection + Filter Interaction', () => {
    it('retains selections when filter changes', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Select some issues
      act(() => {
        capturedCtx?.handleToggle('issue-1');
        capturedCtx?.handleToggle('issue-3');
      });

      await waitFor(() => {
        expect(capturedCtx?.selectedIds.size).toBe(2);
      });

      // Apply filter that hides issue-3
      act(() => {
        capturedCtx?.toggleProvider('zeropath');
      });

      await waitFor(() => {
        // Selection should still include issue-3 even though it's filtered out
        expect(capturedCtx?.selectedIds.has('issue-1')).toBe(true);
        expect(capturedCtx?.selectedIds.has('issue-3')).toBe(true);
      });
    });
  });

  describe('Detail Panel Integration', () => {
    it('opens detail panel for selected issue', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Verify initially closed
      expect(capturedCtx?.isDetailOpen).toBe(false);
      expect(capturedCtx?.detailIssue).toBeNull();

      // Open detail panel
      const issue = capturedCtx?.issues[0];
      act(() => {
        if (issue) {
          capturedCtx?.openDetailPanel(issue);
        }
      });

      await waitFor(() => {
        expect(capturedCtx?.isDetailOpen).toBe(true);
        expect(capturedCtx?.detailIssue?.id).toBe('issue-1');
      });
    });

    it('closes detail panel', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(3);
      });

      // Open then close
      const issue = capturedCtx?.issues[0];
      act(() => {
        if (issue) {
          capturedCtx?.openDetailPanel(issue);
        }
      });

      await waitFor(() => {
        expect(capturedCtx?.isDetailOpen).toBe(true);
      });

      act(() => {
        capturedCtx?.closeDetailPanel();
      });

      await waitFor(() => {
        expect(capturedCtx?.isDetailOpen).toBe(false);
      });
    });
  });
});
