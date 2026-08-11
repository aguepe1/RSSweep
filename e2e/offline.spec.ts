import { test, expect } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

// E5-2 · smoke test offline. AC: el artefacto de distribución `dist/index.html` es
// un ÚNICO HTML autocontenido que arranca y CALCULA abierto vía file:// sin ninguna
// petición de red en runtime (requisito duro: entornos corporativos sin instalar
// nada). El barrido corre en un Web Worker inline (blob) que debe funcionar bajo
// file://. Requiere haber ejecutado `npm run build` antes (CI lo hace).

const distPath = path.resolve(here, "..", "dist", "index.html");
const fileUrl = pathToFileURL(distPath).href;

test.describe("E5-2 · smoke offline (dist/index.html vía file://)", () => {
  test.skip(!existsSync(distPath), "requiere `npm run build` (dist/index.html)");

  test("arranca y calcula sin peticiones de red", async ({ page }) => {
    // Cualquier petición a un host externo (http/https/ws) rompe el requisito
    // offline: la registramos para fallar el test si ocurre.
    const external: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/^(https?|wss?):\/\//i.test(url)) external.push(url);
    });

    await page.goto(fileUrl);

    // El barrido por defecto se ejecuta al cargar (Web Worker inline): si el
    // cajetín muestra el ancho total, el worker corrió correctamente bajo file://.
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido", {
      timeout: 15_000,
    });

    expect(external, `peticiones de red en runtime: ${external.join(", ")}`).toEqual([]);
  });
});
