import { test, expect } from '@playwright/test';

test('loads with top bar and no scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sound/ })).toBeVisible();
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight);
  expect(scrolls).toBe(false);
  expect(errors).toEqual([]);
});
