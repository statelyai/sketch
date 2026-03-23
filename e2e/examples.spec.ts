import { test, expect } from '@playwright/test';

test.describe('Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows examples tab in code panel', async ({ page }) => {
    const examplesTab = page.getByRole('tab', { name: 'Examples' });
    await expect(examplesTab).toBeVisible();
  });

  test('lists all examples when examples tab clicked', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();

    // Check example buttons are listed (use role='button' to avoid strict mode)
    await expect(
      page.getByRole('button', { name: /Traffic Light/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Vending Machine/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Drag & Drop/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Authentication/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Media Player/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Promise/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Stopwatch/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Elevator/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Form Wizard/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Coffee Machine/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Door Lock/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Order Process/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Connection/ }),
    ).toBeVisible();
  });

  test('loads Traffic Light example', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Traffic Light/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('trafficLight');
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

  test('loads Vending Machine example (JSON format)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Vending Machine/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('vendingMachine');
    await expect(
      page.locator('[data-state-id="vendingMachine.idle"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="vendingMachine.hasCredit"]'),
    ).toBeVisible();

    await expect(page.getByTestId('format-badge')).toHaveText('JSON');
  });

  test('loads Promise example (YAML format)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Promise/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('promise');
    await expect(
      page.locator('[data-state-id="promise.pending"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="promise.resolved"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="promise.rejected"]'),
    ).toBeVisible();

    await expect(page.getByTestId('format-badge')).toHaveText('YAML');
  });

  test('loads Authentication example with nested states', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Authentication/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('auth');
    await expect(
      page.locator('[data-state-id="auth.loggedOut"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="auth.loggedIn"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="auth.loggedOut.idle"]'),
    ).toBeVisible();
  });

  test('switches back to Code tab after selecting example', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Stopwatch/ }).click();

    // Should auto-switch to code tab — check aria-selected
    const codeTab = page.getByRole('tab', { name: 'Code' });
    await expect(codeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('loads Door Lock example (Mermaid state diagram)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Door Lock/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('machine');
    await expect(
      page.locator('[data-state-id="machine.Locked"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="machine.Unlocked"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="machine.Open"]'),
    ).toBeVisible();

    await expect(page.getByTestId('format-badge')).toHaveText('Mermaid');
  });

  test('loads Order Process example (Mermaid flowchart)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Order Process/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('machine');
    await expect(
      page.locator('[data-state-id="machine.Pending"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="machine.Processing"]'),
    ).toBeVisible();

    await expect(page.getByTestId('format-badge')).toHaveText('Mermaid');
  });

  test('can simulate Traffic Light example', async ({ page }) => {
    await page.getByRole('tab', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Traffic Light/ }).click();
    await expect(page.getByTestId('machine-name')).toHaveText('trafficLight');

    await page.getByLabel('Start simulation').click();

    await expect(
      page.locator(
        '[data-state-id="trafficLight.green"] [data-sim-active]',
      ),
    ).toBeVisible();

    // Click NEXT to go to yellow
    await page.locator('text=NEXT').first().click();

    await expect(
      page.locator(
        '[data-state-id="trafficLight.yellow"] [data-sim-active]',
      ),
    ).toBeVisible();
  });
});
