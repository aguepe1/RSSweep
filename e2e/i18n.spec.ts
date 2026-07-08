import { test, expect } from "@playwright/test";

// E3-5 · i18n ES/FR/EN: el selector de idioma reescribe los textos estáticos
// (menú, pestañas, leyenda…) y los dinámicos (cajetín, barra de estado) sin
// romper el layout. El español es la fuente de verdad (locale por defecto).

test.describe("E3-5 · i18n ES/FR/EN", () => {
  test("por defecto en español", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-i18n="menu.file"]')).toHaveText("Archivo");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await expect(page.locator("#statusBarHyp")).toContainText("geométrica");
  });

  test("cambia a inglés (estático + dinámico)", async ({ page }) => {
    await page.goto("/");
    await page.locator("#langSel").selectOption("en");

    // estático
    await expect(page.locator('[data-i18n="menu.file"]')).toHaveText("File");
    await expect(page.locator('[data-i18n="tab.veh"]').first()).toHaveText("Vehicle");
    // dinámico: cajetín + barra de estado
    await expect(page.locator("#cartTable")).toContainText("Total swept width");
    await expect(page.locator("#statusBarHyp")).toContainText("geometric");
    await expect(page.locator("#statusBarUnits")).toHaveText("metres · radians");
  });

  test("cambia a francés y no desborda el layout", async ({ page }) => {
    await page.goto("/");
    await page.locator("#langSel").selectOption("fr");

    await expect(page.locator('[data-i18n="menu.file"]')).toHaveText("Fichier");
    await expect(page.locator("#cartTable")).toContainText("Largeur totale balayée");
    await expect(page.locator("#statusBarHyp")).toContainText("géométrique");

    // sin scroll horizontal de página (el shell ocupa exactamente la ventana)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
