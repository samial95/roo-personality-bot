import { test, expect, type Page } from '@playwright/test';

const NAMES = {
  shy: 'Roo the Quiet One',
  playful: 'Roo the Chaos Buddy',
  dramatic: 'Roo the Main Character',
  calm: 'Roo the Zen Unit',
} as const;
type P = keyof typeof NAMES;

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
});
test.afterEach(async ({ page }) => {
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
  expect(scrolls, 'page must never scroll').toBe(false);
  expect(errors).toEqual([]);
});

const current = (page: Page) => page.locator('.screen:not(.leaving)');

async function toIntro(page: Page) {
  await page.goto('/');
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible({ timeout: 5000 });
}

async function answerAll(page: Page, picks: P[]) {
  await current(page).getByRole('button', { name: 'Give me a personality' }).click();
  for (const p of picks) await current(page).locator(`.answer[data-p="${p}"]`).click();
}

test('boot goes to intro by itself', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hi\. I'm Roo\./ })).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('3 questions. A whole new me.')).toBeVisible();
});

for (const p of Object.keys(NAMES) as P[]) {
  test(`all ${p} answers reveal ${NAMES[p]}`, async ({ page }) => {
    await toIntro(page);
    await answerAll(page, [p, p, p]);
    await expect(current(page).getByText('Installing personality')).toBeVisible();
    await expect(current(page).getByText('Deleting boring.exe…')).toBeVisible();
    await expect(current(page).getByRole('heading', { name: NAMES[p] })).toBeVisible({ timeout: 5000 });
    await expect(current(page).locator('.mix')).toHaveAttribute('aria-label', /100%/);
    await expect(current(page).locator('.traits li')).toHaveCount(3);
  });
}

test('ties go to the Q3 answer; mix shows percentages', async ({ page }) => {
  await toIntro(page);
  await answerAll(page, ['shy', 'playful', 'dramatic']);
  await expect(current(page).getByRole('heading', { name: NAMES.dramatic })).toBeVisible({ timeout: 5000 });
  await expect(current(page).locator('.mix')).toHaveAttribute('aria-label', 'Personality mix: Dramatic 34%, Shy 33%, Playful 33%');
});

test('keyboard: A–D answer, Esc goes back, letters stay in place', async ({ page }) => {
  await toIntro(page);
  await page.keyboard.press('Enter');
  await expect(current(page).getByText("It's Friday night.")).toBeVisible();
  await expect(current(page).locator('.answer .key')).toHaveText(['A', 'B', 'C', 'D']);
  await page.keyboard.press('b');
  await expect(current(page).getByText('Someone says hi to me.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(current(page).getByText("It's Friday night.")).toBeVisible();
  await page.keyboard.press('a');
  await page.keyboard.press('c');
  await expect(current(page).getByText('superpower.')).toBeVisible();
  await current(page).getByRole('button', { name: 'Back' }).click();
  await expect(current(page).getByText('Someone says hi to me.')).toBeVisible();
  await page.keyboard.press('d');
  await page.keyboard.press('a');
  await expect(current(page).getByText('Installing personality')).toBeVisible();
});

test('hover previews a personality with a bubble', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is desktop only');
  await toIntro(page);
  await current(page).getByRole('button', { name: 'Give me a personality' }).click();
  await current(page).locator('.answer[data-p="playful"]').hover();
  await expect(page.locator('.bubble')).toHaveText('Ooh… a dance-off?');
  await expect(page.locator('#app')).toHaveClass(/previewing/);
});

test('reveal → customize → share → back, with copy link', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await toIntro(page);
  await answerAll(page, ['playful', 'playful', 'dramatic']);
  await expect(current(page).getByRole('heading', { name: NAMES.playful })).toBeVisible({ timeout: 5000 });

  // switch personality via chips and back
  await current(page).getByRole('radio', { name: 'Calm' }).click();
  await expect(current(page).getByRole('heading', { name: NAMES.calm })).toBeVisible();
  await current(page).getByRole('radio', { name: 'Playful' }).click();
  await expect(current(page).locator('.mix')).toHaveAttribute('aria-label', /Playful 67%, Dramatic 33%/);

  await current(page).getByRole('button', { name: 'Customize Roo' }).click();
  const panel = current(page).locator('.panel');
  await expect(panel.getByRole('heading', { name: 'Customize Roo' })).toBeVisible();
  await panel.getByRole('radio', { name: 'Sky Blue' }).click();
  await expect(panel.getByRole('radio', { name: 'Sky Blue' })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('radio', { name: 'Glossy' }).click();

  await panel.getByRole('tab', { name: 'Moves' }).click();
  await page.keyboard.press('1');
  await expect(panel.getByRole('button', { name: /Dance/ })).toContainText('Playing');

  await panel.getByRole('tab', { name: 'Accessories' }).click();
  await panel.getByRole('radio', { name: 'Party hat' }).click();
  await panel.getByRole('tab', { name: 'Hand' }).click();
  await panel.getByRole('radio', { name: 'Balloon' }).click();
  await expect(panel.locator('.equipped .chip')).toHaveCount(2);
  await panel.getByRole('button', { name: 'Remove Balloon' }).click();
  await expect(panel.locator('.equipped .chip')).toHaveCount(1);

  await panel.getByRole('button', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share your Roo' });
  await expect(dialog).toBeVisible();
  const link = await dialog.getByLabel('Share link').inputValue();
  expect(link).toContain('p=playful');
  expect(link).toContain('b=sky');
  expect(link).toContain('f=glossy');
  expect(link).toContain('head=party');
  await expect(dialog.locator('[data-card]')).toHaveAttribute('src', /^blob:/, { timeout: 5000 });
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.locator('.toast')).toHaveText('Link copied');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(current(page).getByRole('heading', { name: NAMES.playful })).toBeVisible();

  // shared link reproduces the same robot
  await page.goto(link);
  await expect(current(page).getByRole('heading', { name: NAMES.playful })).toBeVisible();
  await expect(current(page).getByRole('button', { name: 'Make your own' })).toBeVisible();
  const look = await page.evaluate(() => window.__roo.look());
  expect(look).toMatchObject({ body: 'sky', finish: 'glossy', acc: { head: 'party', hand: 'none' } });
  await current(page).getByRole('button', { name: 'Make your own' }).click();
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible();
  expect(page.url()).not.toContain('?');
});

test('home confirms only after customizing', async ({ page }) => {
  await toIntro(page);
  await answerAll(page, ['calm', 'calm', 'calm']);
  await expect(current(page).getByRole('heading', { name: NAMES.calm })).toBeVisible({ timeout: 5000 });
  await current(page).getByRole('button', { name: 'Customize Roo' }).click();
  await current(page).getByRole('radio', { name: 'Lime' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Start over?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep editing' }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start over' }).click();
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible();

  // without customizing: no confirm
  await answerAll(page, ['shy', 'shy', 'shy']);
  await expect(current(page).getByRole('heading', { name: NAMES.shy })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible();
});

test('try again, reset and surprise me', async ({ page }) => {
  await toIntro(page);
  await answerAll(page, ['dramatic', 'dramatic', 'calm']);
  await expect(current(page).getByRole('heading', { name: NAMES.dramatic })).toBeVisible({ timeout: 5000 });
  await current(page).getByRole('button', { name: 'Customize Roo' }).click();
  await current(page).getByRole('button', { name: 'Surprise me' }).click();
  await current(page).getByRole('button', { name: 'Reset' }).click();
  expect(await page.evaluate(() => window.__roo.look().body)).toBe('white');
  await current(page).getByRole('button', { name: 'Close customize' }).click();
  await current(page).getByRole('button', { name: 'Try again' }).click();
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible();
});
