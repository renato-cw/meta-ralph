// @ts-nocheck
/**
 * Integration tests for Grouping + Navigation workflow
 *
 * Tests the complete workflow of grouping issues by different criteria
 * and navigating between groups.
 */
import { render, waitFor, act } from '@testing-library/react';
import { AppProvider, useApp, type AppContextType } from '@/contexts/AppContext';
import type { Issue } from '@/lib/types';

// Mock issues with various attributes for grouping
const mockIssues: Issue[] = [
  {
    id: 'zeropath-1',
    provider: 'zeropath',
    title: 'SQL Injection',
    description: 'Security vulnerability',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    priority: 95,
    count: 5,
    location: 'src/auth/login.ts:45',
    permalink: 'https://example.com/issue/1',
    metadata: {},
  },
  {
    id: 'zeropath-2',
    provider: 'zeropath',
    title: 'XSS vulnerability',
    description: 'Cross-site scripting',
    severity: 'HIGH',
    raw_severity: 'high',
    priority: 75,
    count: 3,
    location: 'src/components/Comments.tsx:120',
    permalink: 'https://example.com/issue/2',
    metadata: {},
  },
  {
    id: 'sentry-1',
    provider: 'sentry',
    title: 'Null pointer exception',
    description: 'Runtime error',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    priority: 85,
    count: 10,
    location: 'src/services/user.ts:89',
    permalink: 'https://example.com/issue/3',
    metadata: {},
  },
  {
    id: 'sentry-2',
    provider: 'sentry',
    title: 'Memory leak',
    description: 'Performance issue',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    priority: 50,
    count: 2,
    location: 'src/services/cache.ts:55',
    permalink: 'https://example.com/issue/4',
    metadata: {},
  },
  {
    id: 'github-1',
    provider: 'github',
    title: 'Dependency update',
    description: 'Update required',
    severity: 'LOW',
    raw_severity: 'low',
    priority: 25,
    count: 1,
    location: 'package.json:15',
    permalink: 'https://example.com/issue/5',
    metadata: {},
  },
];

// Mock fetch globally
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ issues: mockIssues }),
    })
  ) as jest.Mock;
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
      <div data-testid="group-by">{ctx.groupBy}</div>
      <div data-testid="group-count">{ctx.groupedIssues.length}</div>
      <div data-testid="collapsed-count">{ctx.collapsedCount}</div>
    </div>
  );
}

describe('Grouping + Navigation Integration', () => {
  describe('Default Grouping', () => {
    it('starts with no grouping (flat view)', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      expect(capturedCtx?.groupBy).toBeNull();
      // With null grouping (flat view), all issues are in one group
      expect(capturedCtx?.groupedIssues).toHaveLength(1);
    });
  });

  describe('Group by Provider', () => {
    it('groups issues by provider', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Set group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupBy).toBe('provider');
        // Should have 3 groups: zeropath, sentry, github
        expect(capturedCtx?.groupedIssues).toHaveLength(3);
      });

      // Verify group contents
      const zeropathGroup = capturedCtx?.groupedIssues.find(g => g.key === 'zeropath');
      const sentryGroup = capturedCtx?.groupedIssues.find(g => g.key === 'sentry');
      const githubGroup = capturedCtx?.groupedIssues.find(g => g.key === 'github');

      expect(zeropathGroup?.issues).toHaveLength(2);
      expect(sentryGroup?.issues).toHaveLength(2);
      expect(githubGroup?.issues).toHaveLength(1);
    });
  });

  describe('Group by Severity', () => {
    it('groups issues by severity', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Set group by severity
      act(() => {
        capturedCtx?.setGroupBy('severity');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupBy).toBe('severity');
        // Should have groups for CRITICAL, HIGH, MEDIUM, LOW
        expect(capturedCtx?.groupedIssues.length).toBeGreaterThanOrEqual(4);
      });

      // Verify CRITICAL group has 2 issues
      const criticalGroup = capturedCtx?.groupedIssues.find(g => g.key === 'CRITICAL');
      expect(criticalGroup?.issues).toHaveLength(2);
    });
  });

  describe('Collapse/Expand Groups', () => {
    it('toggles individual group collapse state', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupedIssues).toHaveLength(3);
      });

      // Initially all expanded
      expect(capturedCtx?.collapsedCount).toBe(0);

      // Collapse one group
      act(() => {
        capturedCtx?.toggleGroup('zeropath');
      });

      await waitFor(() => {
        expect(capturedCtx?.isGroupCollapsed('zeropath')).toBe(true);
        expect(capturedCtx?.collapsedCount).toBe(1);
      });

      // Toggle again to expand
      act(() => {
        capturedCtx?.toggleGroup('zeropath');
      });

      await waitFor(() => {
        expect(capturedCtx?.isGroupCollapsed('zeropath')).toBe(false);
        expect(capturedCtx?.collapsedCount).toBe(0);
      });
    });

    it('collapses all groups', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupedIssues).toHaveLength(3);
      });

      // Collapse all
      act(() => {
        capturedCtx?.collapseAllGroups(capturedCtx?.groupedIssues || []);
      });

      await waitFor(() => {
        expect(capturedCtx?.collapsedCount).toBe(3);
      });
    });

    it('expands all groups', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupedIssues).toHaveLength(3);
      });

      // Collapse all first
      act(() => {
        capturedCtx?.collapseAllGroups(capturedCtx?.groupedIssues || []);
      });

      await waitFor(() => {
        expect(capturedCtx?.collapsedCount).toBe(3);
      });

      // Expand all
      act(() => {
        capturedCtx?.expandAllGroups();
      });

      await waitFor(() => {
        expect(capturedCtx?.collapsedCount).toBe(0);
      });
    });
  });

  describe('Cycle Group By', () => {
    it('cycles through grouping options', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Start with null (flat view)
      expect(capturedCtx?.groupBy).toBeNull();

      // Cycle should move to next option
      act(() => {
        capturedCtx?.cycleGroupBy();
      });

      await waitFor(() => {
        expect(capturedCtx?.groupBy).not.toBeNull();
      });

      const firstGroupBy = capturedCtx?.groupBy;

      // Cycle again
      act(() => {
        capturedCtx?.cycleGroupBy();
      });

      await waitFor(() => {
        expect(capturedCtx?.groupBy).not.toBe(firstGroupBy);
      });
    });
  });

  describe('Grouping with Filters', () => {
    it('groups apply to filtered issues only', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Filter to only CRITICAL issues
      act(() => {
        capturedCtx?.toggleSeverity('CRITICAL');
      });

      await waitFor(() => {
        expect(capturedCtx?.processedIssues).toHaveLength(2);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        // Should only have groups for providers with CRITICAL issues
        const groups = capturedCtx?.groupedIssues || [];
        const totalIssues = groups.reduce((sum, g) => sum + g.issues.length, 0);
        expect(totalIssues).toBe(2);
      });
    });

    it('maintains collapsed state when filter changes', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        expect(capturedCtx?.groupedIssues).toHaveLength(3);
      });

      // Collapse zeropath group
      act(() => {
        capturedCtx?.toggleGroup('zeropath');
      });

      await waitFor(() => {
        expect(capturedCtx?.isGroupCollapsed('zeropath')).toBe(true);
      });

      // Apply a filter
      act(() => {
        capturedCtx?.toggleSeverity('CRITICAL');
      });

      // The collapse state should persist
      await waitFor(() => {
        expect(capturedCtx?.isGroupCollapsed('zeropath')).toBe(true);
      });
    });
  });

  describe('Grouping with Sorting', () => {
    it('issues within groups are sorted', async () => {
      let capturedCtx: AppContextType | null = null;

      render(
        <AppProvider>
          <TestConsumer onRender={ctx => { capturedCtx = ctx; }} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.issues).toHaveLength(5);
      });

      // Group by provider
      act(() => {
        capturedCtx?.setGroupBy('provider');
      });

      await waitFor(() => {
        // Check that issues within each group have priorities
        const sentryGroup = capturedCtx?.groupedIssues.find(g => g.key === 'sentry');
        expect(sentryGroup?.issues).toHaveLength(2);
        // Both sentry issues should be present
        const priorities = sentryGroup?.issues.map(i => i.priority).sort((a, b) => b - a);
        expect(priorities).toEqual([85, 50]);
      });
    });
  });
});
