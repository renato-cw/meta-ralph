/**
 * Tests for useActivityFeed hook
 *
 * @see useActivityFeed.ts
 * @see PRD-03-JSON-STREAMING.md
 */

import { renderHook, act } from '@testing-library/react';
import { useActivityFeed } from '../useActivityFeed';
import type { Activity, ExecutionMetrics } from '@/lib/types';

// Helper to create mock activities
const createActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: `activity-${Date.now()}-${Math.random()}`,
  timestamp: new Date().toISOString(),
  type: 'tool',
  details: 'Test activity',
  status: 'success',
  ...overrides,
});

// Helper to create mock metrics
const createMetrics = (overrides: Partial<ExecutionMetrics> = {}): ExecutionMetrics => ({
  iteration: 1,
  maxIterations: 10,
  costUsd: 0.001,
  durationMs: 1000,
  totalCostUsd: 0.001,
  totalDurationMs: 1000,
  ...overrides,
});

describe('useActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty activities', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.activities).toEqual([]);
    });

    it('should initialize with null metrics', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.metrics).toBeNull();
    });

    it('should initialize with autoScroll enabled by default', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.autoScroll).toBe(true);
    });

    it('should allow customizing autoScroll default', () => {
      const { result } = renderHook(() =>
        useActivityFeed({ autoScrollDefault: false })
      );

      expect(result.current.autoScroll).toBe(false);
    });

    it('should have a container ref', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull();
    });
  });

  describe('addActivity', () => {
    it('should add a single activity', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity = createActivity({ id: 'test-1', details: 'Test 1' });

      act(() => {
        result.current.addActivity(activity);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0]).toEqual(activity);
    });

    it('should add multiple activities in order', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity1 = createActivity({ id: 'test-1', details: 'Test 1' });
      const activity2 = createActivity({ id: 'test-2', details: 'Test 2' });

      act(() => {
        result.current.addActivity(activity1);
        result.current.addActivity(activity2);
      });

      expect(result.current.activities).toHaveLength(2);
      expect(result.current.activities[0]).toEqual(activity1);
      expect(result.current.activities[1]).toEqual(activity2);
    });

    it('should deduplicate activities by ID (update existing)', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity1 = createActivity({ id: 'test-1', details: 'Original' });
      const activity2 = createActivity({ id: 'test-1', details: 'Updated' });

      act(() => {
        result.current.addActivity(activity1);
        result.current.addActivity(activity2);
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].details).toBe('Updated');
    });

    it('should limit activities to maxActivities', () => {
      const { result } = renderHook(() =>
        useActivityFeed({ maxActivities: 5 })
      );

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addActivity(
            createActivity({ id: `test-${i}`, details: `Activity ${i}` })
          );
        }
      });

      expect(result.current.activities).toHaveLength(5);
      // Should keep the most recent 5
      expect(result.current.activities[0].details).toBe('Activity 5');
      expect(result.current.activities[4].details).toBe('Activity 9');
    });
  });

  describe('addActivities', () => {
    it('should add multiple activities at once', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activities = [
        createActivity({ id: 'test-1', details: 'Test 1' }),
        createActivity({ id: 'test-2', details: 'Test 2' }),
        createActivity({ id: 'test-3', details: 'Test 3' }),
      ];

      act(() => {
        result.current.addActivities(activities);
      });

      expect(result.current.activities).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.addActivities([]);
      });

      expect(result.current.activities).toHaveLength(0);
    });

    it('should deduplicate when adding multiple activities', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity1 = createActivity({ id: 'test-1', details: 'Original 1' });
      const activity2 = createActivity({ id: 'test-2', details: 'Original 2' });

      act(() => {
        result.current.addActivities([activity1, activity2]);
      });

      // Now add with same IDs
      const updated1 = createActivity({ id: 'test-1', details: 'Updated 1' });
      const updated2 = createActivity({ id: 'test-2', details: 'Updated 2' });
      const activity3 = createActivity({ id: 'test-3', details: 'New 3' });

      act(() => {
        result.current.addActivities([updated1, updated2, activity3]);
      });

      expect(result.current.activities).toHaveLength(3);
      expect(result.current.activities[0].details).toBe('Updated 1');
      expect(result.current.activities[1].details).toBe('Updated 2');
      expect(result.current.activities[2].details).toBe('New 3');
    });

    it('should respect maxActivities limit', () => {
      const { result } = renderHook(() =>
        useActivityFeed({ maxActivities: 3 })
      );

      const activities = Array.from({ length: 10 }, (_, i) =>
        createActivity({ id: `test-${i}`, details: `Activity ${i}` })
      );

      act(() => {
        result.current.addActivities(activities);
      });

      expect(result.current.activities).toHaveLength(3);
      // Should keep the most recent 3
      expect(result.current.activities[0].details).toBe('Activity 7');
      expect(result.current.activities[2].details).toBe('Activity 9');
    });
  });

  describe('updateActivity', () => {
    it('should update an existing activity', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity = createActivity({ id: 'test-1', details: 'Original', status: 'pending' });

      act(() => {
        result.current.addActivity(activity);
      });

      act(() => {
        result.current.updateActivity('test-1', { details: 'Updated', status: 'success' });
      });

      expect(result.current.activities[0].details).toBe('Updated');
      expect(result.current.activities[0].status).toBe('success');
    });

    it('should not modify activities if ID not found', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity = createActivity({ id: 'test-1', details: 'Original' });

      act(() => {
        result.current.addActivity(activity);
      });

      act(() => {
        result.current.updateActivity('non-existent', { details: 'Updated' });
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].details).toBe('Original');
    });

    it('should only update specified fields', () => {
      const { result } = renderHook(() => useActivityFeed());
      const activity = createActivity({
        id: 'test-1',
        details: 'Original',
        status: 'pending',
        type: 'tool',
      });

      act(() => {
        result.current.addActivity(activity);
      });

      act(() => {
        result.current.updateActivity('test-1', { status: 'success' });
      });

      expect(result.current.activities[0].details).toBe('Original');
      expect(result.current.activities[0].type).toBe('tool');
      expect(result.current.activities[0].status).toBe('success');
    });
  });

  describe('metrics management', () => {
    it('should set metrics', () => {
      const { result } = renderHook(() => useActivityFeed());
      const metrics = createMetrics();

      act(() => {
        result.current.setMetrics(metrics);
      });

      expect(result.current.metrics).toEqual(metrics);
    });

    it('should update metrics', () => {
      const { result } = renderHook(() => useActivityFeed());
      const metrics1 = createMetrics({ iteration: 1, costUsd: 0.001 });
      const metrics2 = createMetrics({ iteration: 2, costUsd: 0.002 });

      act(() => {
        result.current.setMetrics(metrics1);
      });

      act(() => {
        result.current.setMetrics(metrics2);
      });

      expect(result.current.metrics?.iteration).toBe(2);
      expect(result.current.metrics?.costUsd).toBe(0.002);
    });

    it('should clear metrics when set to null', () => {
      const { result } = renderHook(() => useActivityFeed());
      const metrics = createMetrics();

      act(() => {
        result.current.setMetrics(metrics);
      });

      act(() => {
        result.current.setMetrics(null);
      });

      expect(result.current.metrics).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all activities', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.addActivity(createActivity({ id: 'test-1' }));
        result.current.addActivity(createActivity({ id: 'test-2' }));
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.activities).toHaveLength(0);
    });

    it('should clear metrics', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.setMetrics(createMetrics());
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.metrics).toBeNull();
    });

    it('should allow adding activities after clear', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.addActivity(createActivity({ id: 'test-1', details: 'Before' }));
      });

      act(() => {
        result.current.clear();
      });

      act(() => {
        result.current.addActivity(createActivity({ id: 'test-2', details: 'After' }));
      });

      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].details).toBe('After');
    });
  });

  describe('auto-scroll', () => {
    it('should toggle auto-scroll', () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.autoScroll).toBe(true);

      act(() => {
        result.current.toggleAutoScroll();
      });

      expect(result.current.autoScroll).toBe(false);

      act(() => {
        result.current.toggleAutoScroll();
      });

      expect(result.current.autoScroll).toBe(true);
    });

    it('should set auto-scroll directly', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.setAutoScroll(false);
      });

      expect(result.current.autoScroll).toBe(false);

      act(() => {
        result.current.setAutoScroll(true);
      });

      expect(result.current.autoScroll).toBe(true);
    });
  });

  describe('getActivitiesForIssue', () => {
    it('should return activities (currently returns all)', () => {
      const { result } = renderHook(() => useActivityFeed());

      act(() => {
        result.current.addActivity(createActivity({ id: 'test-1' }));
        result.current.addActivity(createActivity({ id: 'test-2' }));
      });

      const issueActivities = result.current.getActivitiesForIssue('any-issue');

      expect(issueActivities).toHaveLength(2);
    });
  });

  describe('activity types', () => {
    it('should handle all activity types', () => {
      const { result } = renderHook(() => useActivityFeed());

      const activityTypes: Activity['type'][] = ['tool', 'message', 'result', 'error', 'push', 'ci'];

      act(() => {
        activityTypes.forEach((type, i) => {
          result.current.addActivity(createActivity({ id: `test-${i}`, type }));
        });
      });

      expect(result.current.activities).toHaveLength(6);
      expect(result.current.activities.map((a) => a.type)).toEqual(activityTypes);
    });

    it('should handle all status types', () => {
      const { result } = renderHook(() => useActivityFeed());

      const statuses: Activity['status'][] = ['pending', 'success', 'error'];

      act(() => {
        statuses.forEach((status, i) => {
          result.current.addActivity(createActivity({ id: `test-${i}`, status }));
        });
      });

      expect(result.current.activities).toHaveLength(3);
      expect(result.current.activities.map((a) => a.status)).toEqual(statuses);
    });
  });
});
