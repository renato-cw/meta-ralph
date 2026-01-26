/**
 * Tests for usePlan Hook (PRD-08)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlan } from '../usePlan';
import type { PlanApiResponse, ImplementationPlan, PlanProgress } from '@/lib/types';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPlan(overrides: Partial<ImplementationPlan> = {}): ImplementationPlan {
  return {
    issueId: 'test-issue-123',
    issueTitle: 'Test Issue',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    analysis: {
      filesIdentified: [],
      rootCause: 'Test root cause',
      proposedSolution: 'Test solution',
    },
    steps: [
      { number: 1, description: 'Step 1', completed: true },
      { number: 2, description: 'Step 2', completed: false },
    ],
    risks: [],
    testStrategy: 'Test strategy',
    progressLog: [],
    rawMarkdown: '# Test Plan',
    ...overrides,
  };
}

function createMockProgress(overrides: Partial<PlanProgress> = {}): PlanProgress {
  return {
    totalSteps: 2,
    completedSteps: 1,
    totalFiles: 0,
    completedFiles: 0,
    percentage: 50,
    ...overrides,
  };
}

function createMockApiResponse(overrides: Partial<PlanApiResponse> = {}): PlanApiResponse {
  return {
    issueId: 'test-issue-123',
    exists: true,
    plan: createMockPlan(),
    progress: createMockProgress(),
    modifiedByUser: false,
    ...overrides,
  };
}

// ============================================================================
// usePlan Tests
// ============================================================================

describe('usePlan', () => {
  describe('Initial State', () => {
    it('should have null plan initially', () => {
      const { result } = renderHook(() => usePlan());

      expect(result.current.plan).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('fetchPlan', () => {
    it('should fetch plan successfully', async () => {
      const mockResponse = createMockApiResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.plan).toEqual(mockResponse.plan);
      expect(result.current.progress).toEqual(mockResponse.progress);
      expect(result.current.exists).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => usePlan());

      act(() => {
        result.current.fetchPlan('test-issue-123');
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse()),
        });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.plan).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.error).toBe('Not found');
    });

    it('should handle non-existent plan', async () => {
      const mockResponse = createMockApiResponse({
        exists: false,
        plan: null,
        progress: null,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.exists).toBe(false);
      expect(result.current.plan).toBeNull();
    });

    it('should URL-encode issue ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse()),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('issue/with/slashes');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/plan/issue%2Fwith%2Fslashes'
      );
    });
  });

  describe('updatePlan', () => {
    it('should update plan successfully', async () => {
      const updatedPlan = createMockPlan({ rawMarkdown: '# Updated' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, plan: updatedPlan }),
      });

      const { result } = renderHook(() => usePlan());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updatePlan('test-issue-123', '# Updated');
      });

      expect(success).toBe(true);
      expect(result.current.plan).toEqual(updatedPlan);
      expect(result.current.modifiedByUser).toBe(true);
    });

    it('should return false on update error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid markdown' }),
      });

      const { result } = renderHook(() => usePlan());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.updatePlan('test-issue-123', 'bad');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Invalid markdown');
    });

    it('should send PUT request with correct body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, plan: createMockPlan() }),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.updatePlan('test-issue-123', '# New Content');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/plan/test-issue-123',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawMarkdown: '# New Content' }),
        })
      );
    });
  });

  describe('deletePlan', () => {
    it('should delete plan successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => usePlan());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deletePlan('test-issue-123');
      });

      expect(success).toBe(true);
      expect(result.current.plan).toBeNull();
      expect(result.current.exists).toBe(false);
    });

    it('should return false on delete error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Plan not found' }),
      });

      const { result } = renderHook(() => usePlan());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.deletePlan('test-issue-123');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Plan not found');
    });

    it('should send DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.deletePlan('test-issue-123');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/plan/test-issue-123', {
        method: 'DELETE',
      });
    });
  });

  describe('clearPlan', () => {
    it('should clear plan state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse()),
      });

      const { result } = renderHook(() => usePlan());

      // First fetch a plan
      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.plan).not.toBeNull();

      // Then clear it
      act(() => {
        result.current.clearPlan();
      });

      expect(result.current.plan).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('refreshPlan', () => {
    it('should re-fetch current plan', async () => {
      const mockResponse = createMockApiResponse();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => usePlan());

      // First fetch
      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Refresh
      await act(async () => {
        await result.current.refreshPlan();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no plan was fetched', async () => {
      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.refreshPlan();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Initial Issue ID', () => {
    it('should fetch plan for initial issue ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse()),
      });

      const { result } = renderHook(() =>
        usePlan({ initialIssueId: 'initial-issue' })
      );

      await waitFor(() => {
        expect(result.current.plan).not.toBeNull();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/plan/initial-issue');
    });
  });

  describe('modifiedByUser flag', () => {
    it('should track manual modifications', async () => {
      const mockResponse = createMockApiResponse({ modifiedByUser: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => usePlan());

      await act(async () => {
        await result.current.fetchPlan('test-issue-123');
      });

      expect(result.current.modifiedByUser).toBe(true);
    });
  });
});
