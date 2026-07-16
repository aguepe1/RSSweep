import { test, expect } from "@playwright/test";

// E4-B5 · UI de la travesía completa y reubicación de configuración del vehículo.
// (a) El toggle «Travesía completa» (opt-in) recalcula y se anota como hipótesis
// activa en la barra de estado; los dorados no cambian porque es opt-in.
// (b) Rótulas y fuelles viven ahora en la pestaña Vehículo.
// (c) El botón «Guardar vehículo» confirma visiblemente que la config se guardó.

test.describe("E4-B5 · travesía completa (opt-in) en la UI", () => {
  test("activar la travesía completa recalcula y la anota como hipótesis activa", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#fullTraversal").check();
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // la barra de estado lista la hipótesis de travesía completa
    await expect(page.locator(".statusbar")).toContainText("travesía completa");
  });
});

test.describe("E4-B5 · configuración del vehículo reubicada", () => {
  test("rótulas y fuelles aparecen dentro de la pestaña Vehículo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // la pestaña Vehículo está activa por defecto y contiene la tabla de rótulas
    await expect(page.locator('.tabpanel[data-tab="veh"] #joints')).toBeVisible();
    await expect(page.locator("#joints table.dtable.jtable")).toHaveCount(1);
  });

  test("el pivote del 2.º bogie es editable y visible en la pestaña Vehículo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#vehPreset").selectOption("3"); // Coche 2 bogies

    const piv = page.locator('#modules input[data-f="pivotRearFromFront"]');
    await expect(piv).toBeVisible();
    await piv.fill("6.5");
    await piv.press("Enter");

    const val = await page.evaluate(
      () =>
        (
          window as unknown as {
            __barrido: { state: { vehicle: { modules: Record<string, number>[] } } };
          }
        ).__barrido.state.vehicle.modules[0].pivotRearFromFront,
    );
    expect(val).toBeCloseTo(6.5, 3);
  });

  test("«Guardar vehículo» confirma visiblemente que la configuración se guardó", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnSaveVeh").click(),
    ]);
    expect(download.suggestedFilename()).toBe("vehiculo.json");
    await expect(page.locator("#vehSaveMsg")).toContainText("guardada");
  });
});
