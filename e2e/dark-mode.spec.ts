import { test, expect } from '@playwright/test';

test.describe('Dark mode', () => {
  test('toggles dark mode on click', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');

    // Toggle dark mode off
    await page.getByLabel('Toggle dark mode').click();

    const hasDark = await html.evaluate((el) => el.classList.contains('dark'));

    // Toggle back
    await page.getByLabel('Toggle dark mode').click();
    const hasDarkAfter = await html.evaluate((el) =>
      el.classList.contains('dark'),
    );
    expect(hasDark).not.toBe(hasDarkAfter);
  });

  test('persists dark mode preference in localStorage', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Toggle dark mode').click();

    const stored = await page.evaluate(() =>
      localStorage.getItem('sketch:dark'),
    );
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(typeof parsed).toBe('boolean');
  });

  test('switches logo based on dark mode', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByTestId('logo');

    const src1 = await logo.getAttribute('src');

    await page.getByLabel('Toggle dark mode').click();

    const src2 = await logo.getAttribute('src');
    expect(src1).not.toBe(src2);
  });

  test('sets color scheme on html element', async ({ page }) => {
    await page.goto('/');

    // Wait for initial render + effect
    await expect(page.locator('[data-state-id]').first()).toBeVisible();

    const scheme1 = await page.evaluate(() => document.documentElement.style.colorScheme);

    await page.getByLabel('Toggle dark mode').click();
    // Wait for React effect to apply
    await page.waitForFunction(
      (prev) => document.documentElement.style.colorScheme !== prev,
      scheme1,
    );

    const scheme2 = await page.evaluate(() => document.documentElement.style.colorScheme);

    expect(scheme1).not.toBe(scheme2);
    expect(['dark', 'light']).toContain(scheme1);
    expect(['dark', 'light']).toContain(scheme2);
  });
});
