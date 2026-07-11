import { test, expect } from "@playwright/test";

// E4-B3 · colocación del bogie dentro del coche. El esquema dibuja las cotas de
// vuelo (testero↦eje) y de empate por bogie; la tabla ofrece campos de vuelo que
// recalculan el pivote (pivote = vuelo + empate/2); un vuelo negativo (eje fuera
// del cuerpo) genera un AVISO no bloqueante en #vehWarnings.

type Win = { __barrido: { state: { vehicle: { modules: Record<string, number>[] } } } };

test.describe("E4-B3 · vuelo y empate", () => {
  test("el esquema dibuja las cotas de vuelo/empate del coche de dos bogies", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#vehPreset").selectOption("3"); // Coche 2 bogies

    // vuelo delantero + empate·2 + vuelo trasero = 4 segmentos acotados
    await expect(page.locator("#schematic svg line.cota-seg")).toHaveCount(4);
  });

  test("editar el vuelo delantero recalcula el pivote (vuelo + empate/2)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#vehPreset").selectOption("3");

    await page.locator('#modules input[data-f="frontVuelo"]').fill("2.0");
    await page.locator('#modules input[data-f="frontVuelo"]').press("Enter");

    // empate 1.85 ⇒ pivote delantero = 2.0 + 0.925 = 2.925
    const piv = await page.evaluate(
      () => (window as unknown as Win).__barrido.state.vehicle.modules[0].pivotFrontFromFront,
    );
    expect(piv).toBeCloseTo(2.925, 3);
  });

  test("un vuelo negativo (eje fuera del cuerpo) avisa sin bloquear el cálculo", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#vehPreset").selectOption("3");

    // vuelo delantero −0.5 ⇒ pivote 0.425 (dentro del cuerpo, no es error) pero el
    // eje queda en −0.5 (fuera): debe avisar, no bloquear.
    await page.locator('#modules input[data-f="frontVuelo"]').fill("-0.5");
    await page.locator('#modules input[data-f="frontVuelo"]').press("Enter");
    await page.locator("#btnRun").dispatchEvent("click");

    await expect(page.locator("#vehWarnings")).toContainText("vuelo delantero negativo");
    await expect(page.locator("#vehErrors")).toBeEmpty();
  });
});
