'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Tag } from '@/lib/types';
import { TAG_COLORS } from '@/lib/types';

const STORAGE_KEY = 'meta-ralph-tags';
const ISSUE_TAGS_KEY = 'meta-ralph-issue-tags';

interface IssueTagsMap {
  [issueId: string]: string[]; // Array of tag IDs
}

/**
 * Hook for managing tags and issue-tag associations.
 *
 * @returns Object with tag state and management functions
 *
 * @example
 * const { tags, createTag, deleteTag, getIssueTags, addTagToIssue } = useTags();
 */
export function useTags() {
  const [tags, setTags] = useLocalStorage<Tag[]>(STORAGE_KEY, []);
  const [issueTags, setIssueTags] = useLocalStorage<IssueTagsMap>(ISSUE_TAGS_KEY, {});

  /**
   * Generate a unique ID for a tag.
   */
  const generateId = useCallback(() => {
    return `tag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  /**
   * Get a random color from the predefined colors.
   */
  const getRandomColor = useCallback(() => {
    return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  }, []);

  /**
   * Create a new tag.
   */
  const createTag = useCallback((name: string, color?: string): Tag => {
    const newTag: Tag = {
      id: generateId(),
      name: name.trim(),
      color: color || getRandomColor(),
    };

    setTags((prev) => [...prev, newTag]);
    return newTag;
  }, [generateId, getRandomColor, setTags]);

  /**
   * Update an existing tag.
   */
  const updateTag = useCallback((id: string, updates: Partial<Omit<Tag, 'id'>>) => {
    setTags((prev) =>
      prev.map((tag) =>
        tag.id === id ? { ...tag, ...updates } : tag
      )
    );
  }, [setTags]);

  /**
   * Delete a tag and remove it from all issues.
   */
  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((tag) => tag.id !== id));

    // Remove tag from all issues
    setIssueTags((prev) => {
      const updated: IssueTagsMap = {};
      for (const [issueId, tagIds] of Object.entries(prev)) {
        const filtered = tagIds.filter((tagId) => tagId !== id);
        if (filtered.length > 0) {
          updated[issueId] = filtered;
        }
      }
      return updated;
    });
  }, [setTags, setIssueTags]);

  /**
   * Get a tag by ID.
   */
  const getTag = useCallback((id: string): Tag | undefined => {
    return tags.find((tag) => tag.id === id);
  }, [tags]);

  /**
   * Get a tag by name (case-insensitive).
   */
  const getTagByName = useCallback((name: string): Tag | undefined => {
    const normalizedName = name.trim().toLowerCase();
    return tags.find((tag) => tag.name.toLowerCase() === normalizedName);
  }, [tags]);

  /**
   * Check if a tag with the given name exists.
   */
  const tagExists = useCallback((name: string): boolean => {
    return getTagByName(name) !== undefined;
  }, [getTagByName]);

  /**
   * Get or create a tag by name.
   */
  const getOrCreateTag = useCallback((name: string, color?: string): Tag => {
    const existing = getTagByName(name);
    if (existing) {
      return existing;
    }
    return createTag(name, color);
  }, [getTagByName, createTag]);

  /**
   * Get tags for a specific issue.
   */
  const getIssueTags = useCallback((issueId: string): Tag[] => {
    const tagIds = issueTags[issueId] || [];
    return tagIds
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is Tag => t !== undefined);
  }, [issueTags, tags]);

  /**
   * Get tag IDs for a specific issue.
   */
  const getIssueTagIds = useCallback((issueId: string): string[] => {
    return issueTags[issueId] || [];
  }, [issueTags]);

  /**
   * Add a tag to an issue.
   */
  const addTagToIssue = useCallback((issueId: string, tagId: string) => {
    setIssueTags((prev) => {
      const currentTags = prev[issueId] || [];
      if (currentTags.includes(tagId)) {
        return prev; // Already has this tag
      }
      return {
        ...prev,
        [issueId]: [...currentTags, tagId],
      };
    });
  }, [setIssueTags]);

  /**
   * Remove a tag from an issue.
   */
  const removeTagFromIssue = useCallback((issueId: string, tagId: string) => {
    setIssueTags((prev) => {
      const currentTags = prev[issueId] || [];
      const filtered = currentTags.filter((id) => id !== tagId);
      if (filtered.length === 0) {
        const { [issueId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [issueId]: filtered,
      };
    });
  }, [setIssueTags]);

  /**
   * Toggle a tag on an issue.
   */
  const toggleTagOnIssue = useCallback((issueId: string, tagId: string) => {
    const currentTags = issueTags[issueId] || [];
    if (currentTags.includes(tagId)) {
      removeTagFromIssue(issueId, tagId);
    } else {
      addTagToIssue(issueId, tagId);
    }
  }, [issueTags, addTagToIssue, removeTagFromIssue]);

  /**
   * Check if an issue has a specific tag.
   */
  const issueHasTag = useCallback((issueId: string, tagId: string): boolean => {
    const currentTags = issueTags[issueId] || [];
    return currentTags.includes(tagId);
  }, [issueTags]);

  /**
   * Add multiple tags to multiple issues (bulk operation).
   */
  const bulkAddTags = useCallback((issueIds: string[], tagIds: string[]) => {
    setIssueTags((prev) => {
      const updated = { ...prev };
      for (const issueId of issueIds) {
        const currentTags = updated[issueId] || [];
        const newTags = [...new Set([...currentTags, ...tagIds])];
        updated[issueId] = newTags;
      }
      return updated;
    });
  }, [setIssueTags]);

  /**
   * Remove multiple tags from multiple issues (bulk operation).
   */
  const bulkRemoveTags = useCallback((issueIds: string[], tagIds: string[]) => {
    setIssueTags((prev) => {
      const updated: IssueTagsMap = {};
      for (const [issueId, currentTags] of Object.entries(prev)) {
        if (issueIds.includes(issueId)) {
          const filtered = currentTags.filter((id) => !tagIds.includes(id));
          if (filtered.length > 0) {
            updated[issueId] = filtered;
          }
        } else {
          updated[issueId] = currentTags;
        }
      }
      return updated;
    });
  }, [setIssueTags]);

  /**
   * Get all issues that have a specific tag.
   */
  const getIssuesByTag = useCallback((tagId: string): string[] => {
    return Object.entries(issueTags)
      .filter(([, tagIds]) => tagIds.includes(tagId))
      .map(([issueId]) => issueId);
  }, [issueTags]);

  /**
   * Get tag usage counts (how many issues have each tag).
   */
  const tagUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of tags) {
      counts[tag.id] = 0;
    }
    for (const tagIds of Object.values(issueTags)) {
      for (const tagId of tagIds) {
        if (counts[tagId] !== undefined) {
          counts[tagId]++;
        }
      }
    }
    return counts;
  }, [tags, issueTags]);

  /**
   * Search tags by name.
   */
  const searchTags = useCallback((query: string): Tag[] => {
    if (!query.trim()) {
      return tags;
    }
    const normalizedQuery = query.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery));
  }, [tags]);

  /**
   * Export tags as JSON string.
   */
  const exportTags = useCallback((): string => {
    return JSON.stringify({ tags, issueTags }, null, 2);
  }, [tags, issueTags]);

  /**
   * Import tags from JSON string.
   */
  const importTags = useCallback((jsonString: string): number => {
    try {
      const data = JSON.parse(jsonString);
      if (!data.tags || !Array.isArray(data.tags)) {
        throw new Error('Invalid tags format');
      }

      // Generate new IDs for imported tags and update issue associations
      const idMapping: Record<string, string> = {};
      const newTags = data.tags.map((tag: Tag) => {
        const newId = generateId();
        idMapping[tag.id] = newId;
        return { ...tag, id: newId };
      });

      // Update issue tags with new IDs
      const newIssueTags: IssueTagsMap = {};
      if (data.issueTags && typeof data.issueTags === 'object') {
        for (const [issueId, tagIds] of Object.entries(data.issueTags)) {
          if (Array.isArray(tagIds)) {
            const mappedIds = tagIds
              .map((id) => idMapping[id as string])
              .filter((id): id is string => id !== undefined);
            if (mappedIds.length > 0) {
              newIssueTags[issueId] = mappedIds;
            }
          }
        }
      }

      setTags((prev) => [...prev, ...newTags]);
      setIssueTags((prev) => ({ ...prev, ...newIssueTags }));

      return newTags.length;
    } catch {
      throw new Error('Failed to parse tags JSON');
    }
  }, [generateId, setTags, setIssueTags]);

  /**
   * Clear all tags and associations.
   */
  const clearAll = useCallback(() => {
    setTags([]);
    setIssueTags({});
  }, [setTags, setIssueTags]);

  return {
    // State
    tags,
    issueTags,

    // Tag CRUD
    createTag,
    updateTag,
    deleteTag,
    getTag,
    getTagByName,
    tagExists,
    getOrCreateTag,

    // Issue-Tag associations
    getIssueTags,
    getIssueTagIds,
    addTagToIssue,
    removeTagFromIssue,
    toggleTagOnIssue,
    issueHasTag,

    // Bulk operations
    bulkAddTags,
    bulkRemoveTags,

    // Queries
    getIssuesByTag,
    tagUsageCounts,
    searchTags,

    // Import/Export
    exportTags,
    importTags,
    clearAll,
  };
}
