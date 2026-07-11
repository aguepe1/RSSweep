import { test, expect } from "@playwright/test";

// E4-A1 · vía de dos carriles. Los carriles se dibujan a ±gauge/2 del eje; son
// presentación (no alteran la envolvente barrida, que ya asume el eje montado
// sobre la línea media dentro del juego de pestaña). Verifica la capa, el ancho
// de vía editable, su sincronización con `state.gauge` y el atajo §5 (tecla 6).

test.describe("E4-A1 · vía de dos carriles", () => {
  test("la capa de carriles arranca activa y el ancho de vía por defecto es 1435 mm", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await expect(page.locator("#layRail")).toBeChecked();
    await expect(page.locator("#trackGauge")).toHaveValue("1435");

    // el estado interno arranca con el ancho estándar en metros
    const g = await page.evaluate(
      () =>
        (window as unknown as { __barrido: { state: { gauge: number } } }).__barrido.state.gauge,
    );
    expect(g).toBeCloseTo(1.435, 3);
  });

  test("editar el ancho de vía actualiza state.gauge (métrico ⇒ 1000 mm)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#trackGauge").fill("1000");
    await page.locator("#trackGauge").dispatchEvent("input");
    const g = await page.evaluate(
      () =>
        (window as unknown as { __barrido: { state: { gauge: number } } }).__barrido.state.gauge,
    );
    expect(g).toBeCloseTo(1.0, 3);
  });

  test("la tecla «6» conmuta la capa de carriles", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await expect(page.locator("#layRail")).toBeChecked();
    await page.locator("#viewport").click();
    await page.keyboard.press("6");
    await expect(page.locator("#layRail")).not.toBeChecked();
    await page.keyboard.press("6");
    await expect(page.locator("#layRail")).toBeChecked();
  });
});
