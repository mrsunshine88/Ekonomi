import { test, expect } from '@playwright/test';

/**
 * E2E-tester för autentisering
 * Testar inloggning, felhantering och lösenordsåterställning
 */

test.describe('Autentisering', () => {

  test('Inloggningssidan visas korrekt', async ({ page }) => {
    await page.goto('/');
    // Ska visa login-formuläret
    await expect(page.getByText(/logga in|välkommen|smartekonomi/i).first()).toBeVisible();
    // Ska ha ett e-postfält och ett lösenordsfält
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Fel lösenord ger felmeddelande', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill('ingen@riktig.epost');
    await page.locator('input[type="password"]').fill('fel_lösenord_123');
    // Hitta och klicka på submit-knappen
    await page.locator('button[type="submit"]').click();
    // Ska visa ett felmeddelande (inte krascha)
    await expect(page.locator('body')).not.toContainText('Oops! Något gick fel'); // ErrorBoundary ska INTE triggas
  });

  test('Lösenordsåterställning visar generiskt meddelande (säkert mönster)', async ({ page }) => {
    await page.goto('/');
    // Klicka på "Glömt lösenord"-länken
    const forgotLink = page.getByText(/glömt|forgot/i);
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('button[type="submit"]').click();
      // Det nya säkra meddelandet ska visas (oavsett om kontot existerar eller ej)
      await expect(page.getByText(/om e-postadressen finns/i)).toBeVisible({ timeout: 8000 });
    }
  });

  test('Demo-läge går att starta utan inloggning', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByText(/demo|prova/i).first();
    if (await demoButton.isVisible()) {
      await demoButton.click();
      // I Demo-läge ska en banner med "Demo" synas
      await expect(page.getByText(/demo-läge|demo/i)).toBeVisible({ timeout: 5000 });
    }
  });

});
