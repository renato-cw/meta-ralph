import { test, expect, mockIssues } from './fixtures';

/**
 * E2E Tests for Bulk Processing Flow
 *
 * Tests the workflow for selecting and processing multiple issues:
 * 1. Selecting individual issues
 * 2. Bulk select all
 * 3. Bulk action bar appears
 * 4. Processing selected issues
 * 5. Clearing selection
 */

test.describe('Bulk Processing Flow', () => {
  test.beforeEach(async ({ page, helpers }) => {
    await helpers.mockApi(page);
    await page.goto('/');
    await helpers.waitForIssuesLoaded(page);
  });

  test.describe('Issue Selection', () => {
    test('can select a single issue', async ({ page, helpers }) => {
      // Select the first issue
      await helpers.selectIssue(page, 'zp-001');

      // Bulk action bar should appear
      await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeVisible();

      // Should show 1 selected
      const selectedCount = await helpers.getSelectedCount(page);
      expect(selectedCount).toBe(1);
    });

    test('can select multiple issues', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');
      await helpers.selectIssue(page, 'zp-002');
      await helpers.selectIssue(page, 'sentry-001');

      const selectedCount = await helpers.getSelectedCount(page);
      expect(selectedCount).toBe(3);
    });

    test('can deselect an issue', async ({ page, helpers }) => {
      // Select two issues
      await helpers.selectIssue(page, 'zp-001');
      await helpers.selectIssue(page, 'zp-002');

      // Deselect one
      await helpers.selectIssue(page, 'zp-001');

      const selectedCount = await helpers.getSelectedCount(page);
      expect(selectedCount).toBe(1);
    });

    test('checkbox toggle works', async ({ page }) => {
      const checkbox = page.locator('[data-testid="issue-checkbox-zp-001"]');

      // Initially unchecked
      await expect(checkbox).not.toBeChecked();

      // Click to check
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // Click to uncheck
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
    });
  });

  test.describe('Select All / Deselect All', () => {
    test('select all button works', async ({ page }) => {
      const selectAllButton = page.getByRole('button', { name: 'Select All' });
      await selectAllButton.click();

      // All issues should be selected
      const bulkBar = page.locator('[data-testid="bulk-action-bar"]');
      await expect(bulkBar).toContainText(`${mockIssues.length} of ${mockIssues.length} selected`);
    });

    test('deselect all button appears after select all', async ({ page }) => {
      const selectAllButton = page.getByRole('button', { name: 'Select All' });
      await selectAllButton.click();

      // Button text should change to Deselect All
      await expect(page.getByRole('button', { name: 'Deselect All' })).toBeVisible();
    });

    test('deselect all clears selection', async ({ page, helpers }) => {
      // Select all
      const selectAllButton = page.getByRole('button', { name: 'Select All' });
      await selectAllButton.click();

      // Click deselect all
      const deselectAllButton = page.getByRole('button', { name: 'Deselect All' });
      await deselectAllButton.click();

      // Bulk action bar should be hidden
      await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeHidden();
    });
  });

  test.describe('Bulk Action Bar', () => {
    test('action bar is hidden when no selection', async ({ page }) => {
      await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeHidden();
    });

    test('action bar appears when issues are selected', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');
      await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeVisible();
    });

    test('action bar shows selection count', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');
      await helpers.selectIssue(page, 'zp-002');

      const bulkBar = page.locator('[data-testid="bulk-action-bar"]');
      await expect(bulkBar).toContainText('2 of');
    });

    test('clear selection button works', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');

      const clearButton = page.locator('[data-testid="clear-selection"]');
      await clearButton.click();

      await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeHidden();
    });

    test('export button is visible', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');

      await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
    });

    test('process button is visible', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');

      await expect(page.locator('[data-testid="bulk-process-button"]')).toBeVisible();
    });
  });

  test.describe('Selection with Filters', () => {
    test('selection persists when filtering', async ({ page, helpers }) => {
      // Select an issue
      await helpers.selectIssue(page, 'zp-001');

      // Apply a filter that includes the selected issue
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Selection should persist
      const selectedCount = await helpers.getSelectedCount(page);
      expect(selectedCount).toBe(1);
    });

    test('can select from filtered results', async ({ page, helpers }) => {
      // Filter to show only CRITICAL issues
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Select from filtered results
      await helpers.selectIssue(page, 'zp-001');
      await helpers.selectIssue(page, 'zp-005');

      const selectedCount = await helpers.getSelectedCount(page);
      expect(selectedCount).toBe(2);
    });
  });

  test.describe('Process Button States', () => {
    test('main process button shows selected count', async ({ page, helpers }) => {
      await helpers.selectIssue(page, 'zp-001');
      await helpers.selectIssue(page, 'zp-002');

      // Button shows "Process 2 Issues"
      const processButton = page.getByRole('button', { name: /Process 2 Issues/i });
      await expect(processButton).toBeVisible();
    });

    test('main process button is disabled when nothing selected', async ({ page }) => {
      // Button shows "Process 0 Issues" and is disabled
      const processButton = page.getByRole('button', { name: /Process 0 Issues/i });
      await expect(processButton).toBeDisabled();
    });
  });
});
