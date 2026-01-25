import { test, expect, mockIssues } from './fixtures';

/**
 * E2E Tests for Detailed Analysis Flow
 *
 * Tests the issue detail panel functionality:
 * 1. Opening the detail panel by clicking a row
 * 2. Viewing issue information
 * 3. Closing the panel
 * 4. Keyboard navigation (Escape to close)
 */

test.describe('Detailed Analysis Flow', () => {
  test.beforeEach(async ({ page, helpers }) => {
    await helpers.mockApi(page);
    await page.goto('/');
    await helpers.waitForIssuesLoaded(page);
  });

  test.describe('Opening Detail Panel', () => {
    test('clicking a row opens the detail panel', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      await expect(page.locator('[data-testid="issue-detail-panel"]')).toBeVisible();
    });

    test('detail panel shows issue title', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel).toContainText('SQL Injection in user authentication');
    });

    test('detail panel shows issue ID', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel).toContainText('zp-001');
    });

    test('detail panel shows provider badge', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel).toContainText('zeropath');
    });

    test('detail panel shows severity badge', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel).toContainText('CRITICAL');
    });

    test('detail panel shows description', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel).toContainText('User input is directly concatenated');
    });

    test('detail panel shows metrics section', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const panel = page.locator('[data-testid="issue-detail-panel"]');
      await expect(panel.getByText('Priority')).toBeVisible();
      await expect(panel.getByText('Count')).toBeVisible();
    });
  });

  test.describe('Closing Detail Panel', () => {
    test('close button closes the panel', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const closeButton = page.locator('[data-testid="detail-close"]');
      await closeButton.click();

      await expect(page.locator('[data-testid="issue-detail-panel"]')).toBeHidden();
    });

    test('pressing Escape closes the panel', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      await page.keyboard.press('Escape');

      await expect(page.locator('[data-testid="issue-detail-panel"]')).toBeHidden();
    });

    test('clicking backdrop closes the panel', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      // Click on the backdrop (black overlay)
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/30');
      await backdrop.click({ position: { x: 10, y: 10 } });

      await expect(page.locator('[data-testid="issue-detail-panel"]')).toBeHidden();
    });
  });

  test.describe('Panel Actions', () => {
    test('View Original link is present', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      const viewOriginalLink = page.getByRole('link', { name: /View Original/i });
      await expect(viewOriginalLink).toBeVisible();
    });

    test('Process Issue button is present', async ({ page, helpers }) => {
      await helpers.openIssueDetail(page, 'zp-001');

      await expect(page.getByRole('button', { name: /Process Issue/i })).toBeVisible();
    });
  });

  test.describe('Opening Different Issues', () => {
    test('can open different issues sequentially', async ({ page, helpers }) => {
      // Open first issue
      await helpers.openIssueDetail(page, 'zp-001');
      await expect(page.locator('[data-testid="issue-detail-panel"]')).toContainText('SQL Injection');

      // Close and open another issue
      await helpers.closeIssueDetail(page);
      await helpers.openIssueDetail(page, 'sentry-001');
      await expect(page.locator('[data-testid="issue-detail-panel"]')).toContainText('TypeError');
    });
  });

  test.describe('Panel with Filtered Results', () => {
    test('can open detail panel from filtered results', async ({ page, helpers }) => {
      // Apply filter
      await helpers.filterBySeverity(page, 'CRITICAL');

      // Open detail from filtered results
      await helpers.openIssueDetail(page, 'zp-001');

      await expect(page.locator('[data-testid="issue-detail-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="issue-detail-panel"]')).toContainText('CRITICAL');
    });
  });
});
