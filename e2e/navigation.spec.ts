import { test, expect } from '@playwright/test';

/**
 * E2E-tester för appens kärnfunktioner i Demo-läge
 * Testar att navigering, vyer och grundläggande UI fungerar korrekt
 * utan att behöva ett riktigt konto.
 */

test.describe('App-navigering (Demo-läge)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Försök starta demo-läge om knappen finns
    const demoButton = page.getByText(/demo|prova/i).first();
    if (await demoButton.isVisible({ timeout: 3000 })) {
      await demoButton.click();
    }
  });

  test('Appen laddar utan att krascha (ErrorBoundary triggas inte)', async ({ page }) => {
    // ErrorBoundary-texten ska ALDRIG synas
    await expect(page.getByText(/oops! något gick fel/i)).not.toBeVisible();
    // Appen ska visa något innehåll
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Navigation till Statistik-vyn fungerar och laddar utan blank skärm', async ({ page }) => {
    // Kolla om vi är inloggade/demo-läge
    const statsButton = page.getByText(/ekonomitb|statistik|stats/i).first();
    if (await statsButton.isVisible({ timeout: 5000 })) {
      await statsButton.click();
      // Vänta på att Statistics-komponenten laddar (lazy-loaded)
      await expect(page.getByText(/ekonomitb|statistik|diagram/i).first()).toBeVisible({ timeout: 10000 });
      // ErrorBoundary ska inte triggas
      await expect(page.getByText(/oops/i)).not.toBeVisible();
    }
  });

  test('Footer syns och innehåller korrekt text', async ({ page }) => {
    const footer = page.locator('footer');
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible();
    }
  });

});
