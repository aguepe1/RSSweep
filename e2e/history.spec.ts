import { test, expect } from "@playwright/test";

// E3-4 · deshacer/rehacer de la edición de entrada: una mutación de panel se
// puede revertir con Ctrl+Z y rehacer con Ctrl+Y; el menú Edición se sincroniza.

test.describe("E3-4 · deshacer/rehacer", () => {
  test("Ctrl+Z revierte y Ctrl+Y rehace añadir un módulo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await expect(page.locator("#modules tbody.mod")).toHaveCount(5);

    // añade un módulo → 6
    await page.locator("#btnAddMod").click();
    await expect(page.locator("#modules tbody.mod")).toHaveCount(6);

    // Ctrl+Z vuelve a 5
    await page.keyboard.press("Control+z");
    await expect(page.locator("#modules tbody.mod")).toHaveCount(5);

    // Ctrl+Y rehace a 6
    await page.keyboard.press("Control+y");
    await expect(page.locator("#modules tbody.mod")).toHaveCount(6);
  });

  test("el menú Edición habilita Deshacer tras una edición", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // al arrancar no hay nada que deshacer
    await expect(page.locator("#menuUndo")).toBeDisabled();
    // una edición (empate global) habilita Deshacer
    await page.locator("#wheelbase").fill("2.1");
    await page.locator("#wheelbase").blur();
    await expect(page.locator("#menuUndo")).toBeEnabled();
    // deshacer desde el menú restaura el valor previo
    await page.locator(".mitem", { hasText: "Edición" }).locator(".mbtn").click();
    await page.locator("#menuUndo").click();
    await expect(page.locator("#wheelbase")).toHaveValue("1.85");
  });
});
