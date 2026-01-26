import { test as base, expect, type Page } from '@playwright/test';
import { mockIssues, mockProcessingState, createMockApiResponse } from './test-data';

/**
 * Custom test fixtures for Meta-Ralph E2E tests
 *
 * These fixtures provide:
 * - API mocking for consistent test data
 * - Helper functions for common interactions
 * - Custom assertions for issue-related elements
 */

interface TestHelpers {
  /**
   * Set up API mock with custom data
   */
  mockApi: (
    page: Page,
    options?: {
      issues?: typeof mockIssues;
      processing?: typeof mockProcessingState;
    }
  ) => Promise<void>;

  /**
   * Wait for issues to be loaded and visible
   */
  waitForIssuesLoaded: (page: Page) => Promise<void>;

  /**
   * Select an issue by its ID
   */
  selectIssue: (page: Page, issueId: string) => Promise<void>;

  /**
   * Get the number of selected issues
   */
  getSelectedCount: (page: Page) => Promise<number>;

  /**
   * Search for issues
   */
  searchIssues: (page: Page, query: string) => Promise<void>;

  /**
   * Clear search
   */
  clearSearch: (page: Page) => Promise<void>;

  /**
   * Open filter bar
   */
  expandFilters: (page: Page) => Promise<void>;

  /**
   * Filter by severity
   */
  filterBySeverity: (page: Page, severity: string) => Promise<void>;

  /**
   * Filter by provider
   */
  filterByProvider: (page: Page, provider: string) => Promise<void>;

  /**
   * Clear all filters
   */
  clearFilters: (page: Page) => Promise<void>;

  /**
   * Open issue detail panel
   */
  openIssueDetail: (page: Page, issueId: string) => Promise<void>;

  /**
   * Close issue detail panel
   */
  closeIssueDetail: (page: Page) => Promise<void>;

  /**
   * Get visible issue count
   */
  getVisibleIssueCount: (page: Page) => Promise<number>;
}

export const test = base.extend<{ helpers: TestHelpers }>({
  helpers: async ({}, use) => {
    const helpers: TestHelpers = {
      mockApi: async (page, options = {}) => {
        const response = createMockApiResponse(
          options.issues ?? mockIssues,
          options.processing ?? mockProcessingState
        );

        await page.route('**/api/issues', async (route) => {
          const method = route.request().method();

          if (method === 'GET') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(response),
            });
          } else if (method === 'POST') {
            // Mock processing start
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Processing started',
                processing: {
                  ...response.processing,
                  isProcessing: true,
                  logs: ['Starting processing...'],
                },
              }),
            });
          }
        });
      },

      waitForIssuesLoaded: async (page) => {
        // Wait for the table to be visible
        await page.waitForSelector('[data-testid="issue-table"], [data-testid="grouped-view"]', {
          timeout: 10000,
        });
        // Wait for at least one issue row to be rendered
        await page.waitForSelector('[data-testid^="issue-row-"]', {
          timeout: 10000,
        });
      },

      selectIssue: async (page, issueId) => {
        const checkbox = page.locator(`[data-testid="issue-checkbox-${issueId}"]`);
        await checkbox.click();
      },

      getSelectedCount: async (page) => {
        const bulkBar = page.locator('[data-testid="bulk-action-bar"]');
        const isVisible = await bulkBar.isVisible();
        if (!isVisible) return 0;
        const text = await bulkBar.textContent();
        // Match "X of Y selected" and capture X
        const match = text?.match(/(\d+)\s+of\s+\d+\s+selected/);
        return match ? parseInt(match[1], 10) : 0;
      },

      searchIssues: async (page, query) => {
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill(query);
        // Wait for debounce
        await page.waitForTimeout(300);
      },

      clearSearch: async (page) => {
        const clearButton = page.locator('[data-testid="search-clear"]');
        if (await clearButton.isVisible()) {
          await clearButton.click();
        }
      },

      expandFilters: async (page) => {
        const filterToggle = page.locator('[data-testid="filter-toggle"]');
        const isExpanded = await filterToggle.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
          await filterToggle.click();
        }
      },

      filterBySeverity: async (page, severity) => {
        await helpers.expandFilters(page);
        const severityFilter = page.locator(`[data-testid="filter-severity-${severity.toLowerCase()}"]`);
        await severityFilter.click();
      },

      filterByProvider: async (page, provider) => {
        await helpers.expandFilters(page);
        const providerFilter = page.locator(`[data-testid="filter-provider-${provider.toLowerCase()}"]`);
        await providerFilter.click();
      },

      clearFilters: async (page) => {
        const clearButton = page.locator('[data-testid="clear-filters"]');
        if (await clearButton.isVisible()) {
          await clearButton.click();
        }
      },

      openIssueDetail: async (page, issueId) => {
        const row = page.locator(`[data-testid="issue-row-${issueId}"]`);
        await row.click();
        await page.waitForSelector('[data-testid="issue-detail-panel"]', {
          state: 'visible',
        });
      },

      closeIssueDetail: async (page) => {
        const closeButton = page.locator('[data-testid="detail-close"]');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForSelector('[data-testid="issue-detail-panel"]', {
            state: 'hidden',
          });
        }
      },

      getVisibleIssueCount: async (page) => {
        const rows = page.locator('[data-testid^="issue-row-"]');
        return await rows.count();
      },
    };

    await use(helpers);
  },
});

export { expect };
export { mockIssues, mockProcessingState };
