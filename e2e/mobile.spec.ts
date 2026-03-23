import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 13']);

test.describe('Mobile layout', () => {
  test('shows tabbed interface instead of split panels', async ({ page }) => {
    await page.goto('/');

    // Mobile shows Visualizer/Code tabs at the bottom
    await expect(page.getByRole('tab', { name: 'Visualizer' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible();
  });

  test('shows visualization by default', async ({ page }) => {
    await page.goto('/');

    // Machine visualization should be visible
    await expect(page.getByTestId('machine-name')).toHaveText('omni');
    await expect(page.locator('[data-state-id="omni.idle"]')).toBeVisible();
  });

  test('switches to Code tab', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('tab', { name: 'Code' }).click();

    // CodeMirror editor should be visible
    await expect(page.getByTestId('code-editor')).toBeVisible();
  });

  test('does not show code editor toggle on mobile', async ({ page }) => {
    await page.goto('/');

    // The toggle code editor button is desktop-only
    await expect(page.getByLabel('Toggle code editor')).toBeHidden();
  });

  test('simulation works on mobile', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Start simulation').click();

    await expect(page.getByLabel('Stop simulation')).toBeVisible();
    await expect(
      page.locator('[data-state-id="omni.idle"] [data-sim-active]'),
    ).toBeVisible();
  });
});
