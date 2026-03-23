import { test, expect, type Page } from '@playwright/test';

/**
 * Replace CodeMirror editor content using clipboard paste.
 * CodeMirror's cmView isn't exposed in production builds,
 * so we select-all + paste via clipboard API.
 */
async function setEditorContent(page: Page, code: string) {
  // Write to clipboard
  await page.evaluate((c) => navigator.clipboard.writeText(c), code);

  // Focus the editor
  await page.locator('.cm-content').click();

  // Select all content
  await page.keyboard.press('Meta+a');

  // Paste from clipboard
  await page.keyboard.press('Meta+v');

  // Small wait for CodeMirror to process paste
  await page.waitForTimeout(100);
}

test.describe('Code editor', () => {
  test.beforeEach(async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await expect(page.getByTestId('code-editor')).toBeVisible();
  });

  test('displays code in CodeMirror editor', async ({ page }) => {
    await expect(page.getByTestId('code-editor')).toBeVisible();
  });

  test('updates machine visualization on code change via Update button', async ({
    page,
  }) => {
    await setEditorContent(
      page,
      `const machine = createMachine({
  id: 'testMachine',
  initial: 'one',
  states: {
    one: { on: { GO: 'two' } },
    two: { on: { BACK: 'one' } },
  },
});`,
    );

    await page.getByTestId('update-button').click();

    await expect(page.getByTestId('machine-name')).toHaveText('testMachine');
    await expect(
      page.locator('[data-state-id="testMachine.one"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-state-id="testMachine.two"]'),
    ).toBeVisible();
  });

  test('updates machine on Cmd+S', async ({ page }) => {
    await setEditorContent(
      page,
      `const machine = createMachine({
  id: 'hotkey',
  initial: 'a',
  states: {
    a: { on: { GO: 'b' } },
    b: {},
  },
});`,
    );

    // Cmd+S to update
    await page.keyboard.press('Meta+s');

    await expect(page.getByTestId('machine-name')).toHaveText('hotkey');
  });

  test('shows error for invalid JSON code', async ({ page }) => {
    // Starts with { so detected as JSON, but invalid JSON -> parse error
    await setEditorContent(page, '{ this is invalid JSON!!!');

    await page.getByTestId('update-button').click();

    // Error banner with SyntaxError should appear in the code panel
    const errorBanner = page.getByTestId('error-banner');
    await expect(errorBanner).toContainText('SyntaxError');
  });

  test('detects JSON format and shows badge', async ({ page }) => {
    await setEditorContent(
      page,
      JSON.stringify(
        {
          id: 'jsonTest',
          initial: 'start',
          states: { start: { on: { GO: 'end' } }, end: {} },
        },
        null,
        2,
      ),
    );

    await page.getByTestId('update-button').click();

    await expect(page.getByTestId('format-badge')).toHaveText('JSON');
    await expect(page.getByTestId('machine-name')).toHaveText('jsonTest');
  });

  test('detects YAML format', async ({ page }) => {
    await setEditorContent(
      page,
      `id: yamlTest
initial: start
states:
  start:
    on:
      GO: end
  end:
    type: final`,
    );

    await page.getByTestId('update-button').click();

    await expect(page.getByTestId('format-badge')).toHaveText('YAML');
    await expect(page.getByTestId('machine-name')).toHaveText('yamlTest');
  });

  test('detects Sketch DSL format', async ({ page }) => {
    await setEditorContent(
      page,
      `MyMachine*
  idle*
    NEXT -> active
  active
    BACK -> idle`,
    );

    await page.getByTestId('update-button').click();

    await expect(page.getByTestId('format-badge')).toHaveText('Sketch');
    await expect(page.getByTestId('machine-name')).toHaveText('MyMachine');
  });
});
