import { expect, test } from '@playwright/test';

test('admin dashboard shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Admin skeleton')).toBeVisible();
  await expect(page.getByText('Dashboard inicial')).toBeVisible();
});

