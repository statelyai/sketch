import { test, expect } from '@playwright/test';

test.describe('Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens examples in a modal from the header', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();

    await expect(page.getByRole('dialog', { name: 'Examples' })).toBeVisible();
  });

  test('shows realistic xstate examples first in the modal list', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();

    const exampleButtons = page.locator('[data-testid="example-list"] button');
    await expect(exampleButtons.nth(0)).toContainText('Session Timeout');
    await expect(exampleButtons.nth(1)).toContainText('OTP Verification');
    await expect(exampleButtons.nth(2)).toContainText('Checkout');
  });

  test('lists examples in the modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();

    // Check example buttons are listed (use role='button' to avoid strict mode)
    await expect(
      page.getByRole('button', { name: /Session Timeout/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /OTP Verification/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Checkout/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Counter/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Traffic Light/ }),
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
    await page.getByRole('button', { name: 'Examples' }).click();
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
    await page.getByRole('button', { name: 'Examples' }).click();
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

  test('simulates Counter example and shows assigned state and context', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Counter/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('counter');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await expect(page.getByTestId('simulation-state')).toContainText('"active"');
    await expect(page.getByTestId('simulation-context')).toContainText('"count": 0');

    await page.getByRole('button', { name: 'Start simulation from panel' }).click();

    const contextPanel = page.getByTestId('simulation-context');
    await expect(page.getByTestId('simulation-state')).toContainText('"active"');
    await expect(contextPanel).toContainText('"count": 0');
    await expect(contextPanel).toContainText('"step": 1');

    await page.getByTestId('transition-event').filter({ hasText: 'INC' }).click();
    await expect(contextPanel).toContainText('"count": 1');

    await page.getByTestId('transition-event').filter({ hasText: 'STEP_5' }).click();
    await expect(contextPanel).toContainText('"step": 5');

    await page.getByTestId('transition-event').filter({ hasText: 'INC' }).click();
    await expect(contextPanel).toContainText('"count": 6');

    await page.getByTestId('transition-event').filter({ hasText: 'RESET' }).click();
    await expect(contextPanel).toContainText('"count": 0');
    await expect(contextPanel).toContainText('"step": 1');
  });

  test('loads Promise example (YAML format)', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
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
    await page.getByRole('button', { name: 'Examples' }).click();
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

  test('returns to Code tab after selecting example from modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Session Timeout/ }).click();

    const codeTab = page.getByRole('tab', { name: 'Code' });
    await expect(codeTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog', { name: 'Examples' })).toHaveCount(0);
  });

  test('loads Door Lock example (Mermaid state diagram)', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
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
    await page.getByRole('button', { name: 'Examples' }).click();
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
    await page.getByRole('button', { name: 'Examples' }).click();
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

  test('loads Session Timeout example and shows xstate format', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
    await page.getByRole('button', { name: /Session Timeout/ }).click();

    await expect(page.getByTestId('machine-name')).toHaveText('sessionTimeout');
    await expect(
      page.locator('[data-state-id="sessionTimeout.active"]'),
    ).toBeVisible();
    await expect(page.getByTestId('format-badge')).toHaveText('XState');
  });
});
