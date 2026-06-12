import { test, expect } from '@playwright/test';

test.describe('SmartEkonomi App E2E', () => {
  test('should load the app and show login page without chunk load errors', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check that we don't have the 'Något gick fel!' error boundary active
    const errorHeading = page.getByRole('heading', { name: 'Något gick fel!' });
    await expect(errorHeading).toHaveCount(0);

    // Verify that the login or onboarding screen is visible.
    // We can check for a common login element.
    const loginButton = page.getByRole('button', { name: /logga in|skapa konto/i });
    await expect(loginButton).toBeVisible();
  });
});
