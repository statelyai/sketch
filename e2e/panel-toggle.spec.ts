import { test, expect } from '@playwright/test';

test.describe('Panel toggle', () => {
  test('toggles code panel open/closed', async ({ page }) => {
    await page.goto('/');

    // Panel should be open by default (Code tab visible)
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible();

    // Click toggle to close
    await page.getByLabel('Toggle code editor').click();

    // Panel should collapse — the Code tab inside the code panel should be hidden
    // Wait for animation
    await page.waitForTimeout(500);

    // Click toggle to reopen
    await page.getByLabel('Toggle code editor').click();
    await page.waitForTimeout(500);

    // Code tab should be visible again
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible();
  });

  test('persists panel state in localStorage', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Toggle code editor').click();

    const stored = await page.evaluate(() =>
      localStorage.getItem('sketch:panelOpen'),
    );
    expect(stored).toBe('false');

    await page.getByLabel('Toggle code editor').click();

    const stored2 = await page.evaluate(() =>
      localStorage.getItem('sketch:panelOpen'),
    );
    expect(stored2).toBe('true');
  });
});
