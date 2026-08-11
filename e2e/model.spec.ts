import { test, expect } from "@playwright/test";

// E5-3 · página en-app «Modelo y límites» (Ayuda ▸ Modelo). AC: se abre desde el
// menú, muestra las hipótesis del modelo y el disclaimer no certificado, se cierra
// con Esc y con el botón, y traduce con el locale.

test.describe("E5-3 · página Modelo y límites", () => {
  async function openModel(page: import("@playwright/test").Page) {
    await page
      .locator(".mitem", { has: page.locator("#menuModel") })
      .locator(".mbtn")
      .click();
    await page.locator("#menuModel").click();
    await expect(page.locator("#modelView")).toBeVisible();
  }

  test("se abre desde Ayuda, muestra hipótesis y disclaimer, y cierra con Esc", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#modelView")).toBeHidden();

    await openModel(page);

    const body = page.locator("#modelBody");
    await expect(body).toContainText("Modelo cinemático del vehículo");
    await expect(body).toContainText("Envolvente cinemática");
    // el disclaimer no certificado nunca se suaviza
    await expect(body).toContainText("NO es un cálculo de gálibo certificado");

    await page.keyboard.press("Escape");
    await expect(page.locator("#modelView")).toBeHidden();
  });

  test("traduce con el locale (EN)", async ({ page }) => {
    await page.goto("/");
    await page.locator("#langSel").selectOption("en");
    await openModel(page);
    await expect(page.locator("#modelBody")).toContainText("Vehicle kinematic model");
    await page.locator("#btnModelClose").click();
    await expect(page.locator("#modelView")).toBeHidden();
  });
});
