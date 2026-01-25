import { renderHook, act } from '@testing-library/react';
import { useTags } from '../useTags';
import type { Tag } from '@/lib/types';

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

describe('useTags', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty tags and issue tags', () => {
      const { result } = renderHook(() => useTags());

      expect(result.current.tags).toEqual([]);
      expect(result.current.issueTags).toEqual({});
    });

    it('should load tags from localStorage', () => {
      const existingTags: Tag[] = [
        { id: 'tag-1', name: 'security', color: '#ef4444' },
        { id: 'tag-2', name: 'bug', color: '#3b82f6' },
      ];
      localStorageMock._setStore({
        'meta-ralph-tags': JSON.stringify(existingTags),
      });

      const { result } = renderHook(() => useTags());

      expect(result.current.tags).toHaveLength(2);
      expect(result.current.tags[0].name).toBe('security');
    });

    it('should load issue tags from localStorage', () => {
      const issueTags = {
        'issue-1': ['tag-1', 'tag-2'],
        'issue-2': ['tag-1'],
      };
      localStorageMock._setStore({
        'meta-ralph-issue-tags': JSON.stringify(issueTags),
      });

      const { result } = renderHook(() => useTags());

      expect(result.current.issueTags).toEqual(issueTags);
    });
  });

  describe('createTag', () => {
    it('should create a new tag with specified color', () => {
      const { result } = renderHook(() => useTags());

      let newTag: Tag | undefined;
      act(() => {
        newTag = result.current.createTag('security', '#ef4444');
      });

      expect(result.current.tags).toHaveLength(1);
      expect(result.current.tags[0].name).toBe('security');
      expect(result.current.tags[0].color).toBe('#ef4444');
      expect(newTag?.id).toBeDefined();
    });

    it('should create a new tag with random color when not specified', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('bug');
      });

      expect(result.current.tags).toHaveLength(1);
      expect(result.current.tags[0].name).toBe('bug');
      expect(result.current.tags[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should trim tag name', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('  security  ', '#ef4444');
      });

      expect(result.current.tags[0].name).toBe('security');
    });

    it('should persist to localStorage', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('security', '#ef4444');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meta-ralph-tags',
        expect.stringContaining('security')
      );
    });
  });

  describe('updateTag', () => {
    it('should update tag name', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('old-name', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.updateTag(tagId, { name: 'new-name' });
      });

      expect(result.current.tags[0].name).toBe('new-name');
    });

    it('should update tag color', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.updateTag(tagId, { color: '#3b82f6' });
      });

      expect(result.current.tags[0].color).toBe('#3b82f6');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      expect(result.current.tags).toHaveLength(1);

      act(() => {
        result.current.deleteTag(tagId);
      });

      expect(result.current.tags).toHaveLength(0);
    });

    it('should remove tag from all issues when deleted', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
        result.current.addTagToIssue('issue-2', tagId);
      });

      expect(result.current.issueTags['issue-1']).toContain(tagId);

      act(() => {
        result.current.deleteTag(tagId);
      });

      expect(result.current.issueTags['issue-1']).toBeUndefined();
      expect(result.current.issueTags['issue-2']).toBeUndefined();
    });
  });

  describe('getTag and getTagByName', () => {
    it('should get tag by ID', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      const tag = result.current.getTag(tagId);
      expect(tag?.name).toBe('security');
    });

    it('should return undefined for non-existent ID', () => {
      const { result } = renderHook(() => useTags());

      const tag = result.current.getTag('non-existent');
      expect(tag).toBeUndefined();
    });

    it('should get tag by name (case-insensitive)', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('Security', '#ef4444');
      });

      expect(result.current.getTagByName('security')?.name).toBe('Security');
      expect(result.current.getTagByName('SECURITY')?.name).toBe('Security');
      expect(result.current.getTagByName('Security')?.name).toBe('Security');
    });
  });

  describe('tagExists', () => {
    it('should return true for existing tag', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('security', '#ef4444');
      });

      expect(result.current.tagExists('security')).toBe(true);
      expect(result.current.tagExists('SECURITY')).toBe(true);
    });

    it('should return false for non-existing tag', () => {
      const { result } = renderHook(() => useTags());

      expect(result.current.tagExists('security')).toBe(false);
    });
  });

  describe('getOrCreateTag', () => {
    it('should return existing tag if found', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('security', '#ef4444');
      });

      let tag: Tag | undefined;
      act(() => {
        tag = result.current.getOrCreateTag('security', '#3b82f6');
      });

      expect(result.current.tags).toHaveLength(1);
      expect(tag?.color).toBe('#ef4444'); // Original color, not the new one
    });

    it('should create new tag if not found', () => {
      const { result } = renderHook(() => useTags());

      let tag: Tag | undefined;
      act(() => {
        tag = result.current.getOrCreateTag('security', '#ef4444');
      });

      expect(result.current.tags).toHaveLength(1);
      expect(tag?.name).toBe('security');
      expect(tag?.color).toBe('#ef4444');
    });
  });

  describe('issue-tag associations', () => {
    it('should add tag to issue', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
      });

      expect(result.current.issueTags['issue-1']).toContain(tagId);
    });

    it('should not add duplicate tag to issue', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
        result.current.addTagToIssue('issue-1', tagId);
      });

      expect(result.current.issueTags['issue-1']).toHaveLength(1);
    });

    it('should remove tag from issue', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
      });

      act(() => {
        result.current.removeTagFromIssue('issue-1', tagId);
      });

      expect(result.current.issueTags['issue-1']).toBeUndefined();
    });

    it('should toggle tag on issue', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.toggleTagOnIssue('issue-1', tagId);
      });

      expect(result.current.issueTags['issue-1']).toContain(tagId);

      act(() => {
        result.current.toggleTagOnIssue('issue-1', tagId);
      });

      expect(result.current.issueTags['issue-1']).toBeUndefined();
    });

    it('should check if issue has tag', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      expect(result.current.issueHasTag('issue-1', tagId)).toBe(false);

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
      });

      expect(result.current.issueHasTag('issue-1', tagId)).toBe(true);
    });

    it('should get tags for issue', () => {
      const { result } = renderHook(() => useTags());

      let tagId1 = '';
      let tagId2 = '';
      act(() => {
        const tag1 = result.current.createTag('security', '#ef4444');
        const tag2 = result.current.createTag('bug', '#3b82f6');
        tagId1 = tag1.id;
        tagId2 = tag2.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId1);
        result.current.addTagToIssue('issue-1', tagId2);
      });

      const issueTags = result.current.getIssueTags('issue-1');
      expect(issueTags).toHaveLength(2);
      expect(issueTags.map((t) => t.name)).toContain('security');
      expect(issueTags.map((t) => t.name)).toContain('bug');
    });
  });

  describe('bulk operations', () => {
    it('should bulk add tags to issues', () => {
      const { result } = renderHook(() => useTags());

      let tagId1 = '';
      let tagId2 = '';
      act(() => {
        const tag1 = result.current.createTag('security', '#ef4444');
        const tag2 = result.current.createTag('bug', '#3b82f6');
        tagId1 = tag1.id;
        tagId2 = tag2.id;
      });

      act(() => {
        result.current.bulkAddTags(['issue-1', 'issue-2'], [tagId1, tagId2]);
      });

      expect(result.current.issueTags['issue-1']).toHaveLength(2);
      expect(result.current.issueTags['issue-2']).toHaveLength(2);
    });

    it('should bulk remove tags from issues', () => {
      const { result } = renderHook(() => useTags());

      let tagId1 = '';
      let tagId2 = '';
      act(() => {
        const tag1 = result.current.createTag('security', '#ef4444');
        const tag2 = result.current.createTag('bug', '#3b82f6');
        tagId1 = tag1.id;
        tagId2 = tag2.id;
      });

      act(() => {
        result.current.bulkAddTags(['issue-1', 'issue-2'], [tagId1, tagId2]);
      });

      act(() => {
        result.current.bulkRemoveTags(['issue-1'], [tagId1]);
      });

      expect(result.current.issueTags['issue-1']).toHaveLength(1);
      expect(result.current.issueTags['issue-1']).toContain(tagId2);
      expect(result.current.issueTags['issue-2']).toHaveLength(2);
    });
  });

  describe('queries', () => {
    it('should get issues by tag', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
        result.current.addTagToIssue('issue-2', tagId);
      });

      const issues = result.current.getIssuesByTag(tagId);
      expect(issues).toHaveLength(2);
      expect(issues).toContain('issue-1');
      expect(issues).toContain('issue-2');
    });

    it('should calculate tag usage counts', () => {
      const { result } = renderHook(() => useTags());

      let tagId1 = '';
      let tagId2 = '';
      act(() => {
        const tag1 = result.current.createTag('security', '#ef4444');
        const tag2 = result.current.createTag('bug', '#3b82f6');
        tagId1 = tag1.id;
        tagId2 = tag2.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId1);
        result.current.addTagToIssue('issue-2', tagId1);
        result.current.addTagToIssue('issue-3', tagId1);
        result.current.addTagToIssue('issue-1', tagId2);
      });

      expect(result.current.tagUsageCounts[tagId1]).toBe(3);
      expect(result.current.tagUsageCounts[tagId2]).toBe(1);
    });

    it('should search tags by name', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('security', '#ef4444');
        result.current.createTag('security-issue', '#3b82f6');
        result.current.createTag('bug', '#22c55e');
      });

      const results = result.current.searchTags('security');
      expect(results).toHaveLength(2);
      expect(results.map((t) => t.name)).toContain('security');
      expect(results.map((t) => t.name)).toContain('security-issue');
    });

    it('should return all tags when search query is empty', () => {
      const { result } = renderHook(() => useTags());

      act(() => {
        result.current.createTag('security', '#ef4444');
        result.current.createTag('bug', '#3b82f6');
      });

      const results = result.current.searchTags('');
      expect(results).toHaveLength(2);
    });
  });

  describe('import/export', () => {
    it('should export tags as JSON', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
      });

      const json = result.current.exportTags();
      const parsed = JSON.parse(json);

      expect(parsed.tags).toHaveLength(1);
      expect(parsed.tags[0].name).toBe('security');
      expect(parsed.issueTags).toHaveProperty('issue-1');
    });

    it('should import tags from JSON', () => {
      const { result } = renderHook(() => useTags());

      const importData = {
        tags: [
          { id: 'old-id-1', name: 'imported-tag', color: '#ef4444' },
        ],
        issueTags: {
          'issue-1': ['old-id-1'],
        },
      };

      let count = 0;
      act(() => {
        count = result.current.importTags(JSON.stringify(importData));
      });

      expect(count).toBe(1);
      expect(result.current.tags).toHaveLength(1);
      expect(result.current.tags[0].name).toBe('imported-tag');
      expect(result.current.tags[0].id).not.toBe('old-id-1'); // New ID assigned
    });

    it('should throw error for invalid JSON', () => {
      const { result } = renderHook(() => useTags());

      expect(() => {
        act(() => {
          result.current.importTags('invalid json');
        });
      }).toThrow('Failed to parse tags JSON');
    });
  });

  describe('clearAll', () => {
    it('should clear all tags and associations', () => {
      const { result } = renderHook(() => useTags());

      let tagId = '';
      act(() => {
        const tag = result.current.createTag('security', '#ef4444');
        tagId = tag.id;
      });

      act(() => {
        result.current.addTagToIssue('issue-1', tagId);
      });

      expect(result.current.tags).toHaveLength(1);
      expect(Object.keys(result.current.issueTags)).toHaveLength(1);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.tags).toHaveLength(0);
      expect(Object.keys(result.current.issueTags)).toHaveLength(0);
    });
  });
});
