import { renderHook, act } from '@testing-library/react';
import { useSavedViews } from '../useSavedViews';
import type { FilterState, GroupBy, SavedView } from '@/lib/types';
import { DEFAULT_FILTER_STATE, DEFAULT_SORT_STATE } from '@/lib/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSavedViews', () => {
  const defaultOptions = {
    currentFilters: DEFAULT_FILTER_STATE,
    currentSort: DEFAULT_SORT_STATE,
    currentGroupBy: null as GroupBy,
  };

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty views array', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(result.current.views).toEqual([]);
      expect(result.current.activeView).toBeNull();
      expect(result.current.defaultView).toBeNull();
    });

    it('should load views from localStorage', () => {
      const existingViews: SavedView[] = [
        {
          id: 'view-1',
          name: 'Test View',
          filters: DEFAULT_FILTER_STATE,
          sort: DEFAULT_SORT_STATE,
          groupBy: null,
          isDefault: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      localStorageMock._setStore({
        'meta-ralph-saved-views': JSON.stringify(existingViews),
      });

      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(result.current.views).toHaveLength(1);
      expect(result.current.views[0].name).toBe('Test View');
    });
  });

  describe('saveView', () => {
    it('should save a new view with the current state', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      act(() => {
        result.current.saveView('My New View');
      });

      expect(result.current.views).toHaveLength(1);
      expect(result.current.views[0].name).toBe('My New View');
      expect(result.current.views[0].filters).toEqual(DEFAULT_FILTER_STATE);
      expect(result.current.views[0].sort).toEqual(DEFAULT_SORT_STATE);
      expect(result.current.views[0].groupBy).toBeNull();
      expect(result.current.views[0].isDefault).toBe(false);
      expect(result.current.activeView?.id).toBe(result.current.views[0].id);
    });

    it('should save view with current filters', () => {
      const customFilters: FilterState = {
        ...DEFAULT_FILTER_STATE,
        providers: ['zeropath', 'sentry'],
        severities: ['CRITICAL', 'HIGH'],
      };

      const { result } = renderHook(() =>
        useSavedViews({
          ...defaultOptions,
          currentFilters: customFilters,
        })
      );

      act(() => {
        result.current.saveView('Critical Issues');
      });

      expect(result.current.views[0].filters.providers).toEqual(['zeropath', 'sentry']);
      expect(result.current.views[0].filters.severities).toEqual(['CRITICAL', 'HIGH']);
    });

    it('should persist to localStorage', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      act(() => {
        result.current.saveView('Persisted View');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meta-ralph-saved-views',
        expect.stringContaining('Persisted View')
      );
    });
  });

  describe('deleteView', () => {
    it('should delete a view by id', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('To Delete');
        viewId = view.id;
      });

      expect(result.current.views).toHaveLength(1);

      act(() => {
        result.current.deleteView(viewId);
      });

      expect(result.current.views).toHaveLength(0);
    });

    it('should clear active view if deleting active view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('Active View');
        viewId = view.id;
      });

      expect(result.current.activeView?.id).toBe(viewId);

      act(() => {
        result.current.deleteView(viewId);
      });

      expect(result.current.activeView).toBeNull();
    });
  });

  describe('loadView', () => {
    it('should call onLoadView callback when loading a view', () => {
      const onLoadView = jest.fn();
      const { result } = renderHook(() =>
        useSavedViews({
          ...defaultOptions,
          onLoadView,
        })
      );

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
      });

      // Clear the callback from saveView
      onLoadView.mockClear();

      act(() => {
        result.current.loadView(viewId);
      });

      expect(onLoadView).toHaveBeenCalledTimes(1);
      expect(onLoadView).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My View' })
      );
    });

    it('should set the view as active', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
        result.current.setActiveView(null);
      });

      expect(result.current.activeView).toBeNull();

      act(() => {
        result.current.loadView(viewId);
      });

      expect(result.current.activeView?.id).toBe(viewId);
    });
  });

  describe('updateView', () => {
    it('should update view properties', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('Original Name');
        viewId = view.id;
      });

      act(() => {
        result.current.updateView(viewId, { name: 'Updated Name' });
      });

      expect(result.current.views[0].name).toBe('Updated Name');
    });

    it('should update the updatedAt timestamp', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      let originalUpdatedAt: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
        originalUpdatedAt = view.updatedAt;
      });

      // Wait a bit to ensure different timestamp
      jest.advanceTimersByTime(1000);

      act(() => {
        result.current.updateView(viewId, { name: 'New Name' });
      });

      expect(result.current.views[0].updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('setDefaultView', () => {
    it('should set a view as default', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
      });

      expect(result.current.views[0].isDefault).toBe(false);

      act(() => {
        result.current.setDefaultView(viewId);
      });

      expect(result.current.views[0].isDefault).toBe(true);
      expect(result.current.defaultView?.id).toBe(viewId);
    });

    it('should unset other defaults when setting a new default', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      act(() => {
        result.current.saveView('View 1');
        result.current.saveView('View 2');
      });

      act(() => {
        result.current.setDefaultView(result.current.views[0].id);
      });

      expect(result.current.views[0].isDefault).toBe(true);
      expect(result.current.views[1].isDefault).toBe(false);

      act(() => {
        result.current.setDefaultView(result.current.views[1].id);
      });

      expect(result.current.views[0].isDefault).toBe(false);
      expect(result.current.views[1].isDefault).toBe(true);
    });

    it('should unset default when passing null', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
      });

      act(() => {
        result.current.setDefaultView(viewId);
      });

      expect(result.current.views[0].isDefault).toBe(true);

      act(() => {
        result.current.setDefaultView(null);
      });

      expect(result.current.views[0].isDefault).toBe(false);
      expect(result.current.defaultView).toBeNull();
    });
  });

  describe('renameView', () => {
    it('should rename a view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('Old Name');
        viewId = view.id;
      });

      act(() => {
        result.current.renameView(viewId, 'New Name');
      });

      expect(result.current.views[0].name).toBe('New Name');
    });
  });

  describe('duplicateView', () => {
    it('should create a copy of a view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('Original');
        viewId = view.id;
      });

      expect(result.current.views).toHaveLength(1);

      act(() => {
        result.current.duplicateView(viewId);
      });

      expect(result.current.views).toHaveLength(2);
      expect(result.current.views[1].name).toBe('Original (Copy)');
      expect(result.current.views[1].id).not.toBe(viewId);
      expect(result.current.views[1].isDefault).toBe(false);
    });

    it('should throw error for non-existent view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(() => {
        act(() => {
          result.current.duplicateView('non-existent-id');
        });
      }).toThrow();
    });
  });

  describe('matchesView', () => {
    it('should return true when current state matches view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
      });

      expect(result.current.matchesView(viewId)).toBe(true);
    });

    it('should return false when current state differs from view', () => {
      const { result, rerender } = renderHook(
        (props) => useSavedViews(props),
        { initialProps: defaultOptions }
      );

      let viewId: string;
      act(() => {
        const view = result.current.saveView('My View');
        viewId = view.id;
      });

      // Rerender with different filters
      rerender({
        ...defaultOptions,
        currentFilters: {
          ...DEFAULT_FILTER_STATE,
          providers: ['zeropath'],
        },
      });

      expect(result.current.matchesView(viewId)).toBe(false);
    });

    it('should return false for non-existent view', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(result.current.matchesView('non-existent-id')).toBe(false);
    });
  });

  describe('exportViews', () => {
    it('should export views as JSON string', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      act(() => {
        result.current.saveView('View 1');
        result.current.saveView('View 2');
      });

      const exported = result.current.exportViews();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('View 1');
      expect(parsed[1].name).toBe('View 2');
    });
  });

  describe('importViews', () => {
    it('should import views from JSON string', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      const viewsToImport: SavedView[] = [
        {
          id: 'old-id',
          name: 'Imported View',
          filters: DEFAULT_FILTER_STATE,
          sort: DEFAULT_SORT_STATE,
          groupBy: null,
          isDefault: true, // Should be reset to false
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      let count: number;
      act(() => {
        count = result.current.importViews(JSON.stringify(viewsToImport));
      });

      expect(count!).toBe(1);
      expect(result.current.views).toHaveLength(1);
      expect(result.current.views[0].name).toBe('Imported View');
      expect(result.current.views[0].id).not.toBe('old-id'); // New ID assigned
      expect(result.current.views[0].isDefault).toBe(false); // Reset to false
    });

    it('should throw error for invalid JSON', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(() => {
        act(() => {
          result.current.importViews('invalid json');
        });
      }).toThrow();
    });

    it('should throw error for non-array JSON', () => {
      const { result } = renderHook(() => useSavedViews(defaultOptions));

      expect(() => {
        act(() => {
          result.current.importViews('{"name": "not an array"}');
        });
      }).toThrow('Failed to parse views JSON');
    });
  });
});
