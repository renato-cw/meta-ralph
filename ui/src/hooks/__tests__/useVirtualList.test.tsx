import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePageSize, PAGE_SIZES } from '../useVirtualList';

// Note: useVirtualList tests are limited because @tanstack/react-virtual
// requires a proper DOM environment with scroll containers.
// Core functionality is tested through integration tests and the build.

// Mock useLocalStorage
jest.mock('../useLocalStorage', () => ({
  useLocalStorage: <T,>(key: string, defaultValue: T) => {
    const [value, setValue] = require('react').useState<T>(defaultValue);
    return [value, setValue] as const;
  },
}));

describe('usePageSize', () => {
  it('returns default page size', () => {
    const { result } = renderHook(() => usePageSize());

    expect(result.current.pageSize).toBe(50);
  });

  it('uses custom default page size', () => {
    const { result } = renderHook(() => usePageSize('test-key', 25));

    expect(result.current.pageSize).toBe(25);
  });

  it('allows setting page size', () => {
    const { result } = renderHook(() => usePageSize());

    act(() => {
      result.current.setPageSize(100);
    });

    expect(result.current.pageSize).toBe(100);
  });

  it('accepts "all" as page size', () => {
    const { result } = renderHook(() => usePageSize());

    act(() => {
      result.current.setPageSize('all');
    });

    expect(result.current.pageSize).toBe('all');
  });

  it('allows setting page size to 25', () => {
    const { result } = renderHook(() => usePageSize());

    act(() => {
      result.current.setPageSize(25);
    });

    expect(result.current.pageSize).toBe(25);
  });
});

describe('PAGE_SIZES', () => {
  it('contains expected values', () => {
    expect(PAGE_SIZES).toEqual([25, 50, 100, 'all']);
  });

  it('has correct length', () => {
    expect(PAGE_SIZES).toHaveLength(4);
  });

  it('includes numeric options', () => {
    expect(PAGE_SIZES.filter(s => typeof s === 'number')).toEqual([25, 50, 100]);
  });

  it('includes "all" option', () => {
    expect(PAGE_SIZES).toContain('all');
  });
});
