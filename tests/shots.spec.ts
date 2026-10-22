import { test, expect, type Page } from '@playwright/test';

// Screenshots of every state for the critique step. Run with: SHOTS=1 npx playwright test shots
test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture screenshots');
test.use({ reducedMotion: 'no-preference' });

const current = (page: Page) => page.locator('.screen:not(.leaving)');

test('capture all states', async ({ page }, info) => {
  test.setTimeout(90_000);
  const dir = `shots/${info.project.name}`;
  const snap = async (name: string, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${dir}/${name}.png` });
  };
  await page.goto('/');
  await snap('01-boot', 900);
  await expect(current(page).getByRole('button', { name: 'Give me a personality' })).toBeVisible({ timeout: 5000 });
  await snap('02-intro', 1200);
  await current(page).getByRole('button', { name: 'Give me a personality' }).click();
  await current(page).locator('.answer[data-p="playful"]').hover();
  await snap('03-q1');
  await current(page).locator('.answer[data-p="playful"]').click();
  await snap('04-q2');
  await current(page).locator('.answer[data-p="playful"]').click();
  await snap('05-q3');
  await current(page).locator('.answer[data-p="dramatic"]').click();
  await snap('06-installing', 1800);
  await expect(current(page).getByRole('heading', { name: 'Roo the Chaos Buddy' })).toBeVisible({ timeout: 5000 });
  await snap('08-reveal-playful', 2500);
  for (const [p, n] of [
    ['Shy', '07-reveal-shy'],
    ['Dramatic', '09-reveal-dramatic'],
    ['Calm', '10-reveal-calm'],
  ]) {
    await current(page).getByRole('radio', { name: p }).click();
    await snap(n, 2600);
  }
  await current(page).getByRole('radio', { name: 'Playful' }).click();
  await current(page).getByRole('button', { name: 'Customize Roo' }).click();
  await current(page).getByRole('radio', { name: 'Sky Blue' }).click();
  await current(page).getByRole('radio', { name: 'Gold', exact: true }).click();
  await snap('11-customize-color', 900);
  await current(page).getByRole('tab', { name: 'Moves' }).click();
  await current(page).getByRole('button', { name: /Dance/ }).click();
  await snap('12-customize-moves', 600);
  await current(page).getByRole('tab', { name: 'Accessories' }).click();
  await current(page).getByRole('radio', { name: 'Party hat' }).click();
  await snap('13-customize-accessories', 900);
  await current(page).getByRole('button', { name: 'Share' }).click();
  await expect(page.locator('[data-card]')).toHaveAttribute('src', /^blob:/, { timeout: 5000 });
  await snap('14-share', 500);
});
