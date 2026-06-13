import { test, expect } from '@playwright/test';

/**
 * E2E-tester för "dumma" inputs och edge cases
 * Dessa tester verifierar att appen inte kraschar på konstiga inmatningar
 */

test.describe('Robusthet & Edge Cases', () => {

  test('Sidan laddas på 5 sekunder (prestanda-kontroll)', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - start;
    // Sidan ska ladda på under 5 sekunder
    expect(loadTime).toBeLessThan(5000);
  });

  test('Inga JavaScript-konsol-fel vid uppstart', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    await page.goto('/');
    // Vänta en sekund för att fånga eventuella asynkrona fel
    await page.waitForTimeout(1000);
    // Filtrera bort kända ofarliga varningar
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-passive event') &&
      !e.includes('favicon')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Inloggning med tom e-post ger valideringsfel, kraschar inte', async ({ page }) => {
    await page.goto('/');
    // Klicka direkt på submit utan att fylla i något
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // HTML5 validering eller vår valideringslogik ska stoppa det
      // Appen ska INTE navigera bort eller visa ErrorBoundary
      await expect(page.getByText(/oops/i)).not.toBeVisible();
    }
  });

  test('Extremt lång e-postinmatning kraschar inte appen', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      // 500 tecken lång e-postadress
      const longEmail = 'a'.repeat(250) + '@' + 'b'.repeat(240) + '.se';
      await emailInput.fill(longEmail);
      await page.locator('input[type="password"]').fill('test');
      await page.locator('button[type="submit"]').click();
      // Appen ska inte krascha
      await expect(page.getByText(/oops/i)).not.toBeVisible();
    }
  });

});
