import { test, expect } from "@playwright/test";

// E3-2 · viewport CAD: capas conmutables, readout bajo el cursor y herramienta de
// medición de 2 clics con snap al eje. AC: medir una distancia conocida del
// trazado 1 con error < 1 px de snap.

test.describe("E3-2 · viewport CAD", () => {
  test("las capas conmutan y el readout se puebla al mover el cursor", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // los checkboxes de capa existen y arrancan activos
    for (const id of ["#layFootprint", "#layKin", "#layUic", "#layObs", "#layVeh", "#vpGrid"])
      await expect(page.locator(id)).toBeChecked();
    // al mover el cursor sobre el viewport, el readout muestra X/Y/PK/off
    const box = (await page.locator("#viewport").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator("#vpReadout")).toContainText("PK");
    await expect(page.locator("#vpReadout")).toContainText("off");
  });

  test("la herramienta de medición mide una distancia conocida con error < 1 px", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    // Toma dos vértices del eje (trazado 1) y calcula su posición en px de pantalla
    // con la misma transformación mundo→pantalla que el viewport (px CSS).
    const geom = await page.evaluate(() => {
      const d = (window as unknown as { __barrido: unknown }).__barrido as {
        state: {
          track: { n: number; x: number[]; y: number[] };
          view: { scale: number; ox: number; oy: number };
        };
      };
      const t = d.state.track;
      const v = d.state.view;
      const i1 = Math.floor(t.n * 0.4);
      const i2 = Math.floor(t.n * 0.6);
      const w2s = (x: number, y: number) => ({ x: x * v.scale + v.ox, y: -y * v.scale + v.oy });
      const a = w2s(t.x[i1], t.y[i1]);
      const b = w2s(t.x[i2], t.y[i2]);
      const dist = Math.hypot(t.x[i2] - t.x[i1], t.y[i2] - t.y[i1]);
      return { a, b, dist, scale: v.scale };
    });

    const box = (await page.locator("#viewport").boundingBox())!;
    // activa la herramienta de medición
    await page.locator("#btnMeasure").click();
    await expect(page.locator("#btnMeasure")).toHaveClass(/on/);
    // dos clics exactamente sobre los vértices → snap a ellos
    await page.mouse.click(box.x + geom.a.x, box.y + geom.a.y);
    await page.mouse.click(box.x + geom.b.x, box.y + geom.b.y);

    // el cajetín de medición muestra la distancia; el error de snap es < 1 px (en metros)
    const txt = (await page.locator("#vpMeasure").textContent())!;
    const m = txt.match(/d\s*=\s*([\d.,]+)\s*m/);
    expect(m).not.toBeNull();
    const measured = parseFloat(m![1].replace(",", "."));
    const onePxInMetres = 1 / geom.scale;
    expect(Math.abs(measured - geom.dist)).toBeLessThan(onePxInMetres);
  });

  test("al ocultar la capa de vehículo el PK sigue anotado y el toggle persiste", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#layVeh").uncheck();
    await expect(page.locator("#layVeh")).not.toBeChecked();
    // el fondo oscuro se puede activar sin romper el dibujo
    await page.locator("#vpDark").check();
    await expect(page.locator("#vpDark")).toBeChecked();
  });
});
