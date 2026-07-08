import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// E3-3 · proyecto como fichero: guardar un `.barrido.json`, alterar el estado y
// reabrir el proyecto reproduce el cálculo bit a bit (mismo cajetín de resultados).

test.describe("E3-3 · proyecto como fichero", () => {
  test("guardar y reabrir un proyecto reproduce el cajetín idéntico", async ({ page }) => {
    // El tiempo de cálculo (wall-clock) es lo único no reproducible del cajetín;
    // se normaliza para comparar los parámetros numéricos bit a bit.
    const norm = (s: string): string => s.replace(/\d+ ms/, "· ms");

    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    const t0 = norm((await page.locator("#cartTable").textContent())!);

    // Guardar proyecto: abre el menú Archivo y captura la descarga
    await page.locator(".mitem", { hasText: "Archivo" }).locator(".mbtn").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#menuSave").click(),
    ]);
    const saved = readFileSync(await download.path(), "utf8");
    expect(saved).toContain('"schema": 1');

    // Alterar el estado: cambiar a otro preset de trazado y recalcular
    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#trackPreset").selectOption("4");
    await expect(page.locator("#cartTable")).toContainText("R100");
    const t1 = norm((await page.locator("#cartTable").textContent())!);
    expect(t1).not.toBe(t0);

    // Reabrir el proyecto guardado → el cajetín vuelve a ser idéntico a t0
    await page.setInputFiles("#fileProject", {
      name: "proyecto.barrido.json",
      mimeType: "application/json",
      buffer: Buffer.from(saved),
    });
    await expect.poll(async () => norm((await page.locator("#cartTable").textContent())!)).toBe(t0);
  });

  test("el autosave se persiste en localStorage tras el cálculo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    const auto = await page.evaluate(() => localStorage.getItem("barrido.autosave.v1"));
    expect(auto).not.toBeNull();
    const doc = JSON.parse(auto!);
    expect(doc.schema).toBe(1);
    expect(Array.isArray(doc.vehicle.modules)).toBe(true);
    expect(doc.track).not.toBeNull();
  });

  test("«Nuevo proyecto» restaura el preset por defecto", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // cambia a otro trazado
    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#trackPreset").selectOption("4");
    await expect(page.locator("#cartTable")).toContainText("R100");
    // Archivo → Nuevo proyecto vuelve al preset 0 (R25 + clotoides)
    await page.locator(".mitem", { hasText: "Archivo" }).locator(".mbtn").click();
    await page.locator("#menuNew").click();
    await expect(page.locator("#cartTable")).toContainText("R25");
  });
});
