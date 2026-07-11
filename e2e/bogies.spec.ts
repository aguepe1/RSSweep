import { test, expect } from "@playwright/test";

// E4-A2 · bastidor de bogie + ejes. Se dibujan en el esquema (SVG en planta) y en
// el viewport (canvas) a partir de `sPivots`/empate; son presentación y no alteran
// la envolvente barrida ni los valores dorados. El esquema es aserible por DOM:
// un bastidor (rect) y dos ejes (line) con el color de bogie por cada módulo bogie.

const BOGIE = "#37474F";

test.describe("E4-A2 · bastidor de bogie", () => {
  test("el esquema dibuja un bastidor y dos ejes por cada bogie", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    const nBogies = await page.evaluate(
      () =>
        (
          window as unknown as {
            __barrido: { state: { vehicle: { modules: { type: string }[] } } };
          }
        ).__barrido.state.vehicle.modules.filter((m) => m.type === "bogie").length,
    );
    expect(nBogies).toBeGreaterThan(0);

    await expect(page.locator(`#schematic svg rect[stroke="${BOGIE}"]`)).toHaveCount(nBogies);
    await expect(page.locator(`#schematic svg line[stroke="${BOGIE}"]`)).toHaveCount(2 * nBogies);
  });

  test("cambiar de preset actualiza el número de bastidores", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    // índices de VEHICLE_PRESETS: 1 = tram3 (2 bogies), 2 = tram7 (4 bogies)
    await page.locator("#vehPreset").selectOption("2");
    await expect(page.locator(`#schematic svg rect[stroke="${BOGIE}"]`)).toHaveCount(4);
    await page.locator("#vehPreset").selectOption("1");
    await expect(page.locator(`#schematic svg rect[stroke="${BOGIE}"]`)).toHaveCount(2);
  });
});
