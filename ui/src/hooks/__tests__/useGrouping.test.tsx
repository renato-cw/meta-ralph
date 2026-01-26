import { renderHook, act } from '@testing-library/react';
import { useGrouping } from '../useGrouping';
import type { Issue } from '@/lib/types';

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockLocalStorage[key] || null);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    mockLocalStorage[key] = value;
  });
});

// Sample issues for testing
const mockIssues: Issue[] = [
  {
    id: '1',
    provider: 'zeropath',
    title: 'XSS Vulnerability',
    description: 'Cross-site scripting found',
    location: 'src/components/Input.tsx',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    count: 5,
    priority: 95,
    permalink: 'https://example.com/1',
    metadata: { lastSeen: new Date().toISOString() },
  },
  {
    id: '2',
    provider: 'sentry',
    title: 'TypeError',
    description: 'Cannot read property of undefined',
    location: 'src/utils/helpers.ts',
    severity: 'HIGH',
    raw_severity: 'high',
    count: 12,
    priority: 75,
    permalink: 'https://example.com/2',
    metadata: { lastSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  },
  {
    id: '3',
    provider: 'zeropath',
    title: 'SQL Injection',
    description: 'Potential SQL injection',
    location: 'src/api/users.ts',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    count: 1,
    priority: 90,
    permalink: 'https://example.com/3',
    metadata: { lastSeen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  },
  {
    id: '4',
    provider: 'sentry',
    title: 'Memory Leak',
    description: 'Memory leak detected',
    location: 'src/components/List.tsx',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    count: 8,
    priority: 50,
    permalink: 'https://example.com/4',
    metadata: {},
  },
];

describe('useGrouping', () => {
  describe('initialization', () => {
    it('initializes with null groupBy (no grouping)', () => {
      const { result } = renderHook(() => useGrouping());
      expect(result.current.groupBy).toBeNull();
    });

    it('initializes with empty collapsed groups', () => {
      const { result } = renderHook(() => useGrouping());
      expect(result.current.collapsedGroups.size).toBe(0);
      expect(result.current.collapsedCount).toBe(0);
    });
  });

  describe('setGroupBy', () => {
    it('sets groupBy to provider', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('provider');
      });

      expect(result.current.groupBy).toBe('provider');
    });

    it('clears collapsed groups when changing groupBy', () => {
      const { result } = renderHook(() => useGrouping());

      // Set a groupBy and collapse a group
      act(() => {
        result.current.setGroupBy('provider');
      });

      act(() => {
        result.current.toggleGroup('zeropath');
      });

      expect(result.current.collapsedGroups.has('zeropath')).toBe(true);

      // Change groupBy should clear collapsed groups
      act(() => {
        result.current.setGroupBy('severity');
      });

      expect(result.current.collapsedGroups.size).toBe(0);
    });
  });

  describe('cycleGroupBy', () => {
    it('cycles through groupBy options', () => {
      const { result } = renderHook(() => useGrouping());

      // Start with null
      expect(result.current.groupBy).toBeNull();

      // Cycle to provider
      act(() => {
        result.current.cycleGroupBy();
      });
      expect(result.current.groupBy).toBe('provider');

      // Cycle to severity
      act(() => {
        result.current.cycleGroupBy();
      });
      expect(result.current.groupBy).toBe('severity');

      // Cycle to date
      act(() => {
        result.current.cycleGroupBy();
      });
      expect(result.current.groupBy).toBe('date');

      // Cycle to location
      act(() => {
        result.current.cycleGroupBy();
      });
      expect(result.current.groupBy).toBe('location');

      // Cycle back to null
      act(() => {
        result.current.cycleGroupBy();
      });
      expect(result.current.groupBy).toBeNull();
    });
  });

  describe('toggleGroup', () => {
    it('collapses a group', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.toggleGroup('provider');
      });

      expect(result.current.isCollapsed('provider')).toBe(true);
      expect(result.current.collapsedCount).toBe(1);
    });

    it('expands a collapsed group', () => {
      const { result } = renderHook(() => useGrouping());

      // Collapse
      act(() => {
        result.current.toggleGroup('provider');
      });

      expect(result.current.isCollapsed('provider')).toBe(true);

      // Expand
      act(() => {
        result.current.toggleGroup('provider');
      });

      expect(result.current.isCollapsed('provider')).toBe(false);
    });
  });

  describe('expandAll', () => {
    it('expands all collapsed groups', () => {
      const { result } = renderHook(() => useGrouping());

      // Collapse multiple groups
      act(() => {
        result.current.toggleGroup('group1');
        result.current.toggleGroup('group2');
      });

      expect(result.current.collapsedCount).toBe(2);

      // Expand all
      act(() => {
        result.current.expandAll();
      });

      expect(result.current.collapsedCount).toBe(0);
    });
  });

  describe('groupIssues', () => {
    it('returns single group when groupBy is null', () => {
      const { result } = renderHook(() => useGrouping());

      const groups = result.current.groupIssues(mockIssues);

      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('all');
      expect(groups[0].label).toBe('All Issues');
      expect(groups[0].issues).toHaveLength(4);
    });

    it('groups issues by provider', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('provider');
      });

      const groups = result.current.groupIssues(mockIssues);

      expect(groups).toHaveLength(2);

      const zeropathGroup = groups.find((g) => g.key === 'zeropath');
      const sentryGroup = groups.find((g) => g.key === 'sentry');

      expect(zeropathGroup).toBeDefined();
      expect(zeropathGroup?.count).toBe(2);
      expect(zeropathGroup?.label).toBe('Zeropath');

      expect(sentryGroup).toBeDefined();
      expect(sentryGroup?.count).toBe(2);
      expect(sentryGroup?.label).toBe('Sentry');
    });

    it('groups issues by severity with correct order', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('severity');
      });

      const groups = result.current.groupIssues(mockIssues);

      expect(groups).toHaveLength(3);

      // CRITICAL should come first, then HIGH, then MEDIUM
      expect(groups[0].key).toBe('CRITICAL');
      expect(groups[0].count).toBe(2);

      expect(groups[1].key).toBe('HIGH');
      expect(groups[1].count).toBe(1);

      expect(groups[2].key).toBe('MEDIUM');
      expect(groups[2].count).toBe(1);
    });

    it('groups issues by date', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('date');
      });

      const groups = result.current.groupIssues(mockIssues);

      // Should have Today, This Week, This Month, Unknown Date groups
      expect(groups.length).toBeGreaterThanOrEqual(1);

      // Verify order - Today should come before This Week, etc.
      const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older', 'Unknown Date'];
      const groupOrder = groups.map((g) => g.key);

      for (let i = 0; i < groupOrder.length - 1; i++) {
        const currentIdx = order.indexOf(groupOrder[i]);
        const nextIdx = order.indexOf(groupOrder[i + 1]);
        expect(currentIdx).toBeLessThan(nextIdx);
      }
    });

    it('groups issues by location (directory)', () => {
      const { result } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('location');
      });

      const groups = result.current.groupIssues(mockIssues);

      // Should group by directory
      const componentsGroup = groups.find((g) => g.key === 'src/components');
      const utilsGroup = groups.find((g) => g.key === 'src/utils');
      const apiGroup = groups.find((g) => g.key === 'src/api');

      expect(componentsGroup).toBeDefined();
      expect(componentsGroup?.count).toBe(2); // Input.tsx and List.tsx

      expect(utilsGroup).toBeDefined();
      expect(utilsGroup?.count).toBe(1);

      expect(apiGroup).toBeDefined();
      expect(apiGroup?.count).toBe(1);
    });
  });

  describe('state persistence', () => {
    it('maintains groupBy state across rerenders', () => {
      const { result, rerender } = renderHook(() => useGrouping());

      act(() => {
        result.current.setGroupBy('provider');
      });

      // Re-render should maintain state
      rerender();
      expect(result.current.groupBy).toBe('provider');
    });

    it('maintains collapsed groups state across rerenders', () => {
      const { result, rerender } = renderHook(() => useGrouping());

      act(() => {
        result.current.toggleGroup('group1');
        result.current.toggleGroup('group2');
      });

      // Re-render should maintain state
      rerender();
      expect(result.current.collapsedGroups.has('group1')).toBe(true);
      expect(result.current.collapsedGroups.has('group2')).toBe(true);
    });
  });
});
