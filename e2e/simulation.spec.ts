import { test, expect } from '@playwright/test';

test.describe('Simulation mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for machine to render
    await expect(page.locator('[data-state-id="trafficLight.green"]')).toBeVisible();
  });

  test('starts simulation when play button clicked', async ({ page }) => {
    await page.getByLabel('Start simulation').click();

    // Play button should be replaced with stop/restart buttons
    await expect(page.getByLabel('Stop simulation')).toBeVisible();
    await expect(page.getByLabel('Restart simulation')).toBeVisible();
  });

  test('highlights initial state in simulation', async ({ page }) => {
    await page.getByLabel('Start simulation').click();

    // The initial state "green" should be marked as sim-active
    const greenNode = page.locator('[data-state-id="trafficLight.green"] [data-sim-active]');
    await expect(greenNode).toBeVisible();
  });

  test('stops simulation when stop button clicked', async ({ page }) => {
    await page.getByLabel('Start simulation').click();
    await expect(page.getByLabel('Stop simulation')).toBeVisible();

    await page.getByLabel('Stop simulation').click();

    // Should return to play button
    await expect(page.getByLabel('Start simulation')).toBeVisible();
    // Active state highlight should be removed
    await expect(page.locator('[data-sim-active]')).toHaveCount(0);
  });

  test('restarts simulation', async ({ page }) => {
    await page.getByLabel('Start simulation').click();

    // green should be active initially
    const greenActive = page.locator(
      '[data-state-id="trafficLight.green"] [data-sim-active]',
    );
    await expect(greenActive).toBeVisible();

    await page.getByLabel('Restart simulation').click();

    // Should still be in sim mode with green active
    await expect(page.getByLabel('Stop simulation')).toBeVisible();
    await expect(greenActive).toBeVisible();
  });

  test('transitions state on event click', async ({ page }) => {
    await page.getByLabel('Start simulation').click();

    // Find and click the NEXT transition
    const nextTransition = page.locator('text=NEXT').first();
    await nextTransition.click();

    // yellow state should now be sim-active
    const yellowActive = page.locator(
      '[data-state-id="trafficLight.yellow"] [data-sim-active]',
    );
    await expect(yellowActive).toBeVisible();

    // green should no longer be active
    await expect(
      page.locator('[data-state-id="trafficLight.green"] [data-sim-active]'),
    ).toHaveCount(0);
  });

  test('shows simulation event history in the side panel', async ({ page }) => {
    await page.getByLabel('Start simulation').click();
    await page.locator('text=NEXT').first().click();

    await page.getByRole('tab', { name: 'Simulation' }).click();

    const eventList = page.getByTestId('simulation-event-list');
    await expect(eventList).toBeVisible();
    await expect(eventList.getByText('NEXT')).toBeVisible();
    await expect(eventList.getByText(/value:/).first()).toBeVisible();
  });

  test('switches the open right panel to simulation when simulation starts', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Code' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByLabel('Start simulation').click();

    await expect(page.getByRole('tab', { name: 'Simulation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('can start simulation from the simulation panel', async ({ page }) => {
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start simulation from panel' }).click();

    await expect(page.getByLabel('Stop simulation')).toBeVisible();
    await expect(page.locator('[data-state-id="trafficLight.green"] [data-sim-active]')).toBeVisible();
  });

  test('returns the right panel to code after simulation stops', async ({ page }) => {
    await page.getByLabel('Start simulation').click();
    await expect(page.getByRole('tab', { name: 'Simulation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByLabel('Stop simulation').click();

    await expect(page.getByRole('tab', { name: 'Code' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('transitions reduce opacity for inactive states', async ({ page }) => {
    await page.getByLabel('Start simulation').click();

    // In sim mode, inactive states should still be visible
    const inactiveState = page.locator(
      '[data-state-id="trafficLight.red"]',
    );
    await expect(inactiveState).toBeVisible();
  });
});
