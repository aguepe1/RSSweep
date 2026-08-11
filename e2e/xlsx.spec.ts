import { test, expect } from "@playwright/test";
import { createReadStream } from "node:fs";

// E4-3 · Export XLSX: Informes ▸ Exportar libro XLSX descarga un .xlsx (ZIP OOXML).

test("Informes ▸ Exportar libro XLSX descarga un .xlsx válido", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => document.getElementById("menuXlsxOut")!.click()),
  ]);
  expect(download.suggestedFilename()).toBe("barrido.xlsx");

  // el fichero empieza por la firma ZIP local "PK\x03\x04"
  const path = await download.path();
  const head = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path, { start: 0, end: 3 })
      .on("data", (c) => chunks.push(c as Buffer))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
  expect([head[0], head[1], head[2], head[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
});
