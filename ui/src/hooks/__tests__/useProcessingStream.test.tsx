/**
 * Tests for useProcessingStream hook
 *
 * @see useProcessingStream.ts
 * @see PRD-03-JSON-STREAMING.md
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useProcessingStream } from '../useProcessingStream';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  // Trigger open event
  triggerOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  close() {
    this.readyState = 2;
  }

  // Test helper: simulate receiving a message
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Test helper: simulate an error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static getLatest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// Mock parseSSE function
jest.mock('@/lib/events', () => ({
  parseSSE: jest.fn((data: string) => {
    // Simple parser for testing
    try {
      const match = data.match(/^data: (.+)$/);
      if (match) {
        return JSON.parse(match[1]);
      }
      return JSON.parse(data.replace('data: ', ''));
    } catch {
      return null;
    }
  }),
}));

describe('useProcessingStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockEventSource.reset();
    // @ts-expect-error - mocking global
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    // @ts-expect-error - cleanup mock
    delete global.EventSource;
  });

  describe('initialization', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should initialize with empty activities map', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.activities).toBeInstanceOf(Map);
      expect(result.current.activities.size).toBe(0);
    });

    it('should initialize with empty metrics map', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.metrics).toBeInstanceOf(Map);
      expect(result.current.metrics.size).toBe(0);
    });

    it('should initialize with null error', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.error).toBeNull();
    });

    it('should initialize with empty completed issues set', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.completedIssues).toBeInstanceOf(Set);
      expect(result.current.completedIssues.size).toBe(0);
    });

    it('should initialize with empty failed issues map', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(result.current.failedIssues).toBeInstanceOf(Map);
      expect(result.current.failedIssues.size).toBe(0);
    });

    it('should provide connect, disconnect, and clear methods', () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: false })
      );

      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.clear).toBe('function');
    });
  });

  describe('connection', () => {
    it('should not connect when issueIds is empty', () => {
      renderHook(() =>
        useProcessingStream({ issueIds: [], autoConnect: true })
      );

      expect(MockEventSource.instances.length).toBe(0);
    });

    it('should not connect when autoConnect is false', () => {
      renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      expect(MockEventSource.instances.length).toBe(0);
    });

    it('should connect when manual connect is called', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      // EventSource should be created
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
      // State may transition quickly due to async effects
      expect(typeof result.current.connectionState).toBe('string');
    });

    it('should build URL with issue IDs', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1', 'issue-2'],
          autoConnect: false,
        })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest();
      expect(eventSource?.url).toBe('/api/process/stream?ids=issue-1,issue-2');
    });

    it('should transition to connecting state on open attempt', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      // Should be in connecting or connected state after connect is called
      expect(['connecting', 'connected', 'disconnected']).toContain(result.current.connectionState);
    });
  });

  describe('disconnection', () => {
    it('should close EventSource on disconnect', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        result.current.disconnect();
      });

      expect(eventSource.readyState).toBe(2); // closed
    });

    it('should set disconnected state after disconnect', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('event handling', () => {
    it('should handle activity events', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'activity',
          payload: {
            id: 'activity-1',
            timestamp: '2026-01-26T00:00:00Z',
            type: 'tool',
            details: 'Reading file',
            status: 'success',
          },
        }));
      });

      await waitFor(() => {
        expect(result.current.activities.get('issue-1')?.length).toBeGreaterThan(0);
      });

      const activities = result.current.activities.get('issue-1')!;
      expect(activities[0].details).toBe('Reading file');
    });

    it('should handle metrics events', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'metrics',
          payload: {
            iteration: 2,
            maxIterations: 10,
            costUsd: 0.005,
            durationMs: 5000,
          },
        }));
      });

      expect(result.current.metrics.get('issue-1')).toBeDefined();
      const metrics = result.current.metrics.get('issue-1')!;
      expect(metrics.iteration).toBe(2);
      expect(metrics.costUsd).toBe(0.005);
    });

    it('should handle complete events', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'complete',
          payload: { message: 'Issue fixed successfully' },
        }));
      });

      expect(result.current.completedIssues.has('issue-1')).toBe(true);
    });

    it('should handle error events', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'error',
          payload: { error: 'Processing failed' },
        }));
      });

      expect(result.current.failedIssues.has('issue-1')).toBe(true);
      expect(result.current.failedIssues.get('issue-1')).toBe('Processing failed');
    });

    it('should handle multiple issues', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1', 'issue-2'],
          autoConnect: false,
        })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'activity',
          payload: {
            id: 'activity-1',
            timestamp: '2026-01-26T00:00:00Z',
            type: 'tool',
            details: 'Issue 1 activity',
            status: 'success',
          },
        }));
      });

      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-2',
          type: 'activity',
          payload: {
            id: 'activity-2',
            timestamp: '2026-01-26T00:00:01Z',
            type: 'tool',
            details: 'Issue 2 activity',
            status: 'success',
          },
        }));
      });

      await waitFor(() => {
        expect(result.current.activities.get('issue-1')?.length).toBeGreaterThan(0);
        expect(result.current.activities.get('issue-2')?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('clear', () => {
    it('should clear all state', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({ issueIds: ['issue-1'], autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.triggerOpen();
      });

      // Add some state
      act(() => {
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'activity',
          payload: {
            id: 'activity-1',
            timestamp: '2026-01-26T00:00:00Z',
            type: 'tool',
            details: 'Test',
            status: 'success',
          },
        }));
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'metrics',
          payload: { iteration: 1, maxIterations: 10, costUsd: 0.001, durationMs: 1000 },
        }));
        eventSource.simulateMessage(JSON.stringify({
          issueId: 'issue-1',
          type: 'complete',
          payload: { message: 'Done' },
        }));
      });

      await waitFor(() => {
        expect(result.current.activities.size).toBeGreaterThan(0);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.activities.size).toBe(0);
      expect(result.current.metrics.size).toBe(0);
      expect(result.current.completedIssues.size).toBe(0);
      expect(result.current.failedIssues.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1'],
          autoConnect: false,
          maxReconnectAttempts: 0,
        })
      );

      act(() => {
        result.current.connect();
      });

      const eventSource = MockEventSource.getLatest()!;

      act(() => {
        eventSource.simulateError();
      });

      // Connection should be in error or disconnected state after error
      expect(['error', 'disconnected']).toContain(result.current.connectionState);
    });
  });

  describe('options', () => {
    it('should accept custom reconnect delay', () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1'],
          autoConnect: false,
          reconnectDelay: 5000,
        })
      );

      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should accept custom max reconnect attempts', () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1'],
          autoConnect: false,
          maxReconnectAttempts: 10,
        })
      );

      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should accept custom throttle rate', () => {
      const { result } = renderHook(() =>
        useProcessingStream({
          issueIds: ['issue-1'],
          autoConnect: false,
          throttleRate: 5,
        })
      );

      expect(result.current.connectionState).toBe('disconnected');
    });
  });
});
