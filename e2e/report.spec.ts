import { test, expect } from "@playwright/test";

// E4-1 · Informe de gálibo: vista HTML paginada imprimible a PDF. Es solo
// presentación sobre `state` (no toca el motor). Se abre desde Informes ▸ Ver
// informe… (o Ctrl+P). Verifica secciones, hash de parámetros y cierre.

test.describe("E4-1 · informe de gálibo", () => {
  async function openReport(page: import("@playwright/test").Page) {
    await page.locator(".mitem", { hasText: "Informes" }).locator(".mbtn").click();
    await page.locator("#menuReport").click();
    await expect(page.locator("#reportView")).toBeVisible();
  }

  test("se abre con portada, hash de parámetros y las secciones esperadas", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await openReport(page);

    // portada: título + cajetín con hash de parámetros (8 hex)
    await expect(page.locator("#reportBody .rp-cart-title")).toContainText("Informe de gálibo");
    const hash = (await page.locator("#reportBody .rp-mono").first().innerText()).trim();
    expect(hash).toMatch(/^[0-9a-f]{8}$/);

    // secciones mínimas: portada + entradas + hipótesis + resultados (≥4 páginas)
    expect(await page.locator("#reportBody .rp-page").count()).toBeGreaterThanOrEqual(4);
    // planta y diagrama de semianchos son SVG vectoriales (no canvas)
    expect(await page.locator("#reportBody .rp-svg").count()).toBeGreaterThanOrEqual(2);
    // tabla por PK con cabecera
    await expect(page.locator("#reportBody .rp-pk-tbl")).toBeVisible();
    // leyenda para B/N (patrón de trazo por serie)
    await expect(page.locator("#reportBody .rp-legend")).toBeVisible();
  });

  test("el hash de parámetros es determinista (mismas entradas ⇒ mismo hash)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await openReport(page);
    const h1 = (await page.locator("#reportBody .rp-mono").first().innerText()).trim();
    await page.keyboard.press("Escape");
    await expect(page.locator("#reportView")).toBeHidden();
    await openReport(page);
    const h2 = (await page.locator("#reportBody .rp-mono").first().innerText()).trim();
    expect(h2).toBe(h1);
  });

  test("activar la envolvente cinemática añade su columna en el perfil por PK", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#kinEnabled").check();
    await page.locator("#btnRun").click();
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    await openReport(page);
    // la tabla por PK gana la columna "Kin tot"
    await expect(page.locator("#reportBody .rp-pk-tbl thead")).toContainText("Kin tot");
    await page.keyboard.press("Escape");
    await expect(page.locator("#reportView")).toBeHidden();
  });
});
