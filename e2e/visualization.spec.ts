import { test, expect } from '@playwright/test';

test.describe('Machine visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows transitions with event names', async ({ page }) => {
    // NEXT event should appear as a transition
    await expect(page.getByText('NEXT').first()).toBeVisible();
    // EMERGENCY event
    await expect(page.getByText('EMERGENCY').first()).toBeVisible();
  });

  test('shows nested child states', async ({ page }) => {
    // red has nested substates
    await expect(
      page.locator('[data-state-id="trafficLight.red.waiting"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.red.pedestrianCrossing"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.red.turnArrow"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.red.clearance"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.red.flash"]'),
    ).toBeVisible();
  });

  test('shows after (delayed) transitions', async ({ page }) => {
    // green has after: { 5000: ... }
    // The display should show "5000" or the delay text
    await expect(page.getByText('5000').first()).toBeVisible();
  });

  test('shows top-level states', async ({ page }) => {
    await expect(
      page.locator('[data-state-id="trafficLight.green"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.yellow"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="trafficLight.red"]'),
    ).toBeVisible();
  });

  test('highlights target on transition hover', async ({ page }) => {
    // Hover over a NEXT transition on green — should highlight yellow
    const nextTransition = page
      .locator('[data-state-id="trafficLight.green"]')
      .locator('text=NEXT')
      .first();

    // The yellow card
    const yellowCard = page.locator(
      '[data-state-id="trafficLight.yellow"] [data-testid="state-card"]',
    );

    await nextTransition.hover();
    // Wait for highlight effect
    await page.waitForTimeout(200);

    // After hover, yellow node should have highlight border
    const classes = await yellowCard.getAttribute('class');
    expect(classes).toContain('border-primary');
  });

  test('shows RESET event on flash state', async ({ page }) => {
    // flash state has RESET event
    const flashNode = page.locator('[data-state-id="trafficLight.red.flash"]');
    await expect(flashNode).toBeVisible();
    await expect(page.getByText('RESET').first()).toBeVisible();
  });

  test('shows PEDESTRIAN_REQUEST event', async ({ page }) => {
    await expect(page.getByText('PEDESTRIAN_REQUEST').first()).toBeVisible();
  });
});
