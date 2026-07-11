import { test, expect } from "@playwright/test";

// E4-B2 · coche de dos bogies. El preset «Coche 2 bogies» (índice 3 de
// VEHICLE_PRESETS) es un cuerpo rígido único sobre DOS pivotes: el esquema dibuja
// dos bastidores (rect) y cuatro ejes (line) para el único módulo biBogie, y la
// tabla de módulos ofrece el tipo «2 bogies». La envolvente se calcula igual que
// para cualquier vehículo (contra-cálculo), sin tocar los valores dorados.

const BOGIE = "#37474F";

test.describe("E4-B2 · coche de dos bogies", () => {
  test("el preset dibuja dos bastidores y resuelve la envolvente", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await page.locator("#vehPreset").selectOption("3");

    // un solo módulo biBogie → dos bastidores de bogie y cuatro ejes en el esquema
    await expect(page.locator(`#schematic svg rect[stroke="${BOGIE}"]`)).toHaveCount(2);
    await expect(page.locator(`#schematic svg line[stroke="${BOGIE}"]`)).toHaveCount(4);

    // la tabla de módulos ofrece el tipo «2 bogies» seleccionado
    await expect(page.locator('#modules select[data-f="type"]')).toHaveValue("biBogie");

    // la cadena resuelve: el ancho de vía del barrido se refleja en el cajetín
    const width = await page.evaluate(
      () =>
        (
          window as unknown as {
            __barrido: { state: { vehicle: { modules: { type: string }[] } } };
          }
        ).__barrido.state.vehicle.modules.filter((m) => m.type === "biBogie").length,
    );
    expect(width).toBe(1);
  });
});
