import { test, expect, mockIssues } from './fixtures';

/**
 * E2E Tests for Discovery & Filtering Flow
 *
 * Tests the primary user journey of discovering and filtering issues:
 * 1. Page loads with issues displayed
 * 2. Filters can be applied (provider, severity, priority range)
 * 3. Search functionality works
 * 4. Filter presets work
 * 5. Combinations of filters and search work together
 */

test.describe('Discovery & Filtering Flow', () => {
  test.beforeEach(async ({ page, helpers }) => {
    // Mock the API to return test data
    await helpers.mockApi(page);
    await page.goto('/');
    await helpers.waitForIssuesLoaded(page);
  });

  test.describe('Initial Page Load', () => {
    test('displays page title and description', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Issue Queue' })).toBeVisible();
      await expect(page.getByText('Select issues to process with Claude Code')).toBeVisible();
    });

    test('displays all mock issues on load', async ({ page, helpers }) => {
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(mockIssues.length);
    });

    test('shows issue count in results text', async ({ page }) => {
      await expect(page.getByText(`${mockIssues.length} issues`)).toBeVisible();
    });

    test('displays refresh button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('search input is visible and accessible', async ({ page }) => {
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeVisible();
    });

    test('can search by issue title', async ({ page, helpers }) => {
      await helpers.searchIssues(page, 'SQL Injection');

      // Should filter to only the SQL injection issue
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(1);

      // Verify the correct issue is shown
      await expect(page.locator('[data-testid="issue-row-zp-001"]')).toBeVisible();
    });

    test('search is case insensitive', async ({ page, helpers }) => {
      await helpers.searchIssues(page, 'sql injection');

      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(1);
    });

    test('can search by description content', async ({ page, helpers }) => {
      // Search for something in the description of sentry issues
      await helpers.searchIssues(page, 'TypeError');

      // Should find sentry-001 which has TypeError in title
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBeGreaterThan(0);
    });

    test('shows no results for non-matching search', async ({ page, helpers }) => {
      await helpers.searchIssues(page, 'nonexistentissue12345');

      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(0);
    });

    test('can clear search', async ({ page, helpers }) => {
      await helpers.searchIssues(page, 'SQL Injection');

      // Clear the search
      await helpers.clearSearch(page);

      // Should show all issues again
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(mockIssues.length);
    });

    test('pressing / focuses search input', async ({ page }) => {
      const searchInput = page.locator('[data-testid="search-input"]');

      // Press / to focus search
      await page.keyboard.press('/');

      // Verify search is focused
      await expect(searchInput).toBeFocused();
    });
  });

  test.describe('Filter Bar', () => {
    test('filter bar is visible', async ({ page }) => {
      await expect(page.locator('[data-testid="filter-toggle"]')).toBeVisible();
    });

    test('can expand filter bar', async ({ page, helpers }) => {
      await helpers.expandFilters(page);

      // Check that severity filter buttons are visible
      await expect(page.locator('[data-testid="filter-severity-critical"]')).toBeVisible();
    });

    test('filter by severity - CRITICAL', async ({ page, helpers }) => {
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Should only show CRITICAL issues
      const visibleRows = page.locator('[data-testid^="issue-row-"]');
      const count = await visibleRows.count();

      // We have 2 CRITICAL issues in mock data (zp-001, zp-005)
      expect(count).toBe(2);
    });

    test('filter by severity - multiple selections', async ({ page, helpers }) => {
      await helpers.filterBySeverity(page, 'CRITICAL');
      await helpers.filterBySeverity(page, 'HIGH');

      // Should show both CRITICAL and HIGH issues
      const count = await helpers.getVisibleIssueCount(page);

      // 2 CRITICAL + 2 HIGH = 4 issues
      expect(count).toBe(4);
    });

    test('filter by provider', async ({ page, helpers }) => {
      await helpers.filterByProvider(page, 'zeropath');

      // Should only show zeropath issues
      const count = await helpers.getVisibleIssueCount(page);

      // We have 5 zeropath issues in mock data
      expect(count).toBe(5);
    });

    test('can clear all filters', async ({ page, helpers }) => {
      // Apply some filters
      await helpers.filterBySeverity(page, 'CRITICAL');
      await helpers.filterByProvider(page, 'zeropath');

      // Clear filters
      await helpers.clearFilters(page);

      // Should show all issues
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(mockIssues.length);
    });

    test('shows active filter count badge', async ({ page, helpers }) => {
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Check that filter count is shown
      const filterToggle = page.locator('[data-testid="filter-toggle"]');
      await expect(filterToggle).toContainText('1');
    });
  });

  test.describe('Combined Search and Filter', () => {
    test('search and filter work together', async ({ page, helpers }) => {
      // Filter by zeropath provider
      await helpers.filterByProvider(page, 'zeropath');

      // Then search within zeropath issues
      await helpers.searchIssues(page, 'SQL');

      // Should show only zeropath SQL injection issue
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(1);

      await expect(page.locator('[data-testid="issue-row-zp-001"]')).toBeVisible();
    });

    test('clearing search keeps filters applied', async ({ page, helpers }) => {
      // Filter by CRITICAL severity
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Search for something
      await helpers.searchIssues(page, 'SQL');

      // Clear search
      await helpers.clearSearch(page);

      // Should still show only CRITICAL issues
      const count = await helpers.getVisibleIssueCount(page);
      expect(count).toBe(2); // 2 CRITICAL issues
    });
  });

  test.describe('Sorting', () => {
    test('can sort by priority', async ({ page }) => {
      // Click priority header to sort
      const priorityHeader = page.locator('th').filter({ hasText: 'Priority' });
      await priorityHeader.click();

      // Verify sort indicator is shown
      await expect(priorityHeader).toContainText(/[↑↓]/);
    });

    test('can sort by severity', async ({ page }) => {
      const severityHeader = page.locator('th').filter({ hasText: 'Severity' });
      await severityHeader.click();

      await expect(severityHeader).toContainText(/[↑↓]/);
    });

    test('clicking same header toggles sort direction', async ({ page }) => {
      const priorityHeader = page.locator('th').filter({ hasText: 'Priority' });

      // Default state is priority descending (↓)
      // First click on already-active desc field -> toggles to ascending
      await priorityHeader.click();
      await expect(priorityHeader).toContainText('↑');

      // Second click - toggles back to descending
      await priorityHeader.click();
      await expect(priorityHeader).toContainText('↓');
    });
  });

  test.describe('Results Display', () => {
    test('shows filtered count when filters are active', async ({ page, helpers }) => {
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Should show "Showing X of Y issues"
      await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();
    });

    test('shows search term in results when searching', async ({ page, helpers }) => {
      await helpers.searchIssues(page, 'SQL');

      // Should show search term in results text
      await expect(page.getByText(/matching "SQL"/)).toBeVisible();
    });
  });
});
