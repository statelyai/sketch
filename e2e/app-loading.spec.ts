import { test, expect } from '@playwright/test';

test.describe('App loading', () => {
  test('renders header with Stately logo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('logo')).toBeVisible();
  });

  test('renders default machine visualization', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('machine-name')).toHaveText('omni');
  });

  test('renders state nodes from default machine', async ({ page }) => {
    await page.goto('/');
    // Default machine contains these top-level states
    const stateNodes = page.locator('[data-state-id]');
    await expect(stateNodes.first()).toBeVisible();

    // Check for known states from default machine
    await expect(page.locator('[data-state-id="omni.idle"]')).toBeVisible();
    await expect(page.locator('[data-state-id="omni.loading"]')).toBeVisible();
    await expect(page.locator('[data-state-id="omni.success"]')).toBeVisible();
    await expect(page.locator('[data-state-id="omni.failed"]')).toBeVisible();
  });

  test('renders code editor panel on desktop', async ({ page }) => {
    await page.goto('/');
    // Code panel has tabs for Code and Simulation
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Simulation' })).toBeVisible();
  });

  test('renders examples launcher in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('header').getByRole('button', { name: 'Examples' })).toBeVisible();
  });

  test('renders simulation controls', async ({ page }) => {
    await page.goto('/');
    // Play button should be visible in footer
    const playButton = page.getByLabel('Start simulation');
    await expect(playButton).toBeVisible();
  });

  test('renders dark mode toggle', async ({ page }) => {
    await page.goto('/');
    const darkToggle = page.getByLabel('Toggle dark mode');
    await expect(darkToggle).toBeVisible();
  });

  test('renders code editor toggle button', async ({ page }) => {
    await page.goto('/');
    const toggleButton = page.getByLabel('Toggle code editor');
    await expect(toggleButton).toBeVisible();
  });

  test('shows format badge for default code', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByTestId('format-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('XState');
  });

  test('shows Update button in code panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('update-button')).toBeVisible();
  });
});
