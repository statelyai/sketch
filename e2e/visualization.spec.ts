import { test, expect } from '@playwright/test';

test.describe('Machine visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows state descriptions', async ({ page }) => {
    // Default machine has descriptions on states
    await expect(page.getByText('Waiting for user action')).toBeVisible();
    await expect(
      page.getByText('Fetching data from remote service'),
    ).toBeVisible();
  });

  test('shows entry/exit actions on states', async ({ page }) => {
    // "loading" state has entry: ['notifyUser']
    const loadingNode = page.locator('[data-state-id="omni.loading"]');
    await expect(loadingNode.getByText('notifyUser')).toBeVisible();
    await expect(loadingNode.getByText('entry')).toBeVisible();
  });

  test('shows invocations on states', async ({ page }) => {
    // "loading" state invokes 'fetchData'
    const loadingNode = page.locator('[data-state-id="omni.loading"]');
    await expect(loadingNode.getByText('fetchData')).toBeVisible();
    await expect(loadingNode.getByText('invoke')).toBeVisible();
  });

  test('shows transitions with event names', async ({ page }) => {
    // FETCH event should appear as a transition
    await expect(page.getByText('FETCH').first()).toBeVisible();
    // CANCEL event
    await expect(page.getByText('CANCEL').first()).toBeVisible();
  });

  test('shows guard prefixes (if/else)', async ({ page }) => {
    // The failed state has guarded RETRY transitions
    const failedNode = page.locator('[data-state-id="omni.failed"]');
    await expect(failedNode).toBeVisible();

    // Should show if/else pattern
    await expect(page.getByText('if').first()).toBeVisible();
  });

  test('shows parallel state regions', async ({ page }) => {
    // Default machine has a parallel state "parallel"
    await expect(
      page.locator('[data-state-id="omni.parallel"]'),
    ).toBeVisible();

    // Parallel state has "monitor" and "status" regions
    await expect(
      page.locator('[data-state-id="omni.parallel.monitor"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="omni.parallel.status"]'),
    ).toBeVisible();
  });

  test('shows final state', async ({ page }) => {
    // "timedOut" is a final state
    await expect(
      page.locator('[data-state-id="omni.timedOut"]'),
    ).toBeVisible();
  });

  test('shows nested child states', async ({ page }) => {
    // parallel.monitor has "watching" child
    await expect(
      page.locator('[data-state-id="omni.parallel.monitor.watching"]'),
    ).toBeVisible();
    // parallel.status has "ok" and "degraded" children
    await expect(
      page.locator('[data-state-id="omni.parallel.status.ok"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="omni.parallel.status.degraded"]'),
    ).toBeVisible();
  });

  test('shows history state', async ({ page }) => {
    // parallel.monitor has "hist" history state
    await expect(
      page.locator('[data-state-id="omni.parallel.monitor.hist"]'),
    ).toBeVisible();
    // History state shows H badge
    await expect(page.getByText('H', { exact: true })).toBeVisible();
  });

  test('shows root-level transitions', async ({ page }) => {
    // The root "omni" machine has a global RESET transition
    await expect(page.getByText('RESET').first()).toBeVisible();
  });

  test('highlights target on transition hover', async ({ page }) => {
    // Hover over a FETCH transition on idle — should highlight loading
    const fetchTransition = page
      .locator('[data-state-id="omni.idle"]')
      .locator('text=FETCH')
      .first();

    // The loading card
    const loadingCard = page.locator(
      '[data-state-id="omni.loading"] [data-testid="state-card"]',
    );

    await fetchTransition.hover();
    // Wait for highlight effect
    await page.waitForTimeout(200);

    // After hover, loading node should have highlight border
    const classes = await loadingCard.getAttribute('class');
    expect(classes).toContain('border-primary');
  });

  test('shows transition actions', async ({ page }) => {
    // The loading -> failed transition has actions: ['logError', 'incrementRetries']
    await expect(page.getByText('logError').first()).toBeVisible();
    await expect(page.getByText('incrementRetries').first()).toBeVisible();
  });

  test('shows after (delayed) transitions', async ({ page }) => {
    // idle has after: { IDLE_TIMEOUT: 'timedOut' }
    // The display should show "IDLE_TIMEOUT" text
    await expect(page.getByText('IDLE_TIMEOUT').first()).toBeVisible();
  });
});
