import { test, expect } from "@playwright/test";

// E4-B1 · importar dos carriles de un DXF. Con el modo «dos carriles» activo, el eje
// pasa a ser la línea media entre ambos rieles y el ancho de vía (`state.gauge`) se
// fija con la separación medida. Aquí se importa un DXF mínimo con dos rectas
// paralelas a ±0.7175 m (vía estándar 1435 mm) y se comprueba la sincronización.

const DXF = [
  "0",
  "SECTION",
  "2",
  "ENTITIES",
  "0",
  "LINE",
  "8",
  "RAIL_L",
  "10",
  "0.0",
  "20",
  "0.7175",
  "11",
  "20.0",
  "21",
  "0.7175",
  "0",
  "LINE",
  "8",
  "RAIL_R",
  "10",
  "0.0",
  "20",
  "-0.7175",
  "11",
  "20.0",
  "21",
  "-0.7175",
  "0",
  "ENDSEC",
  "0",
  "EOF",
].join("\n");

test.describe("E4-B1 · importar dos carriles del DXF", () => {
  test("el modo «dos carriles» deriva el eje medio y fija el ancho de vía", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#fileDxf").setInputFiles({
      name: "vias.dxf",
      mimeType: "application/dxf",
      buffer: Buffer.from(DXF),
    });
    await expect(page.locator("#trackInfo")).toContainText("vias.dxf");

    await expect(page.locator("#dxfRailsRow")).toBeVisible();
    await page.locator("#dxfRails").check();

    await expect(page.locator("#trackInfo")).toContainText("2 carriles");
    await expect(page.locator("#trackInfo")).toContainText("1435 mm");
    await expect(page.locator("#trackGauge")).toHaveValue("1435");

    const g = await page.evaluate(
      () =>
        (window as unknown as { __barrido: { state: { gauge: number } } }).__barrido.state.gauge,
    );
    expect(g).toBeCloseTo(1.435, 3);
  });
});
