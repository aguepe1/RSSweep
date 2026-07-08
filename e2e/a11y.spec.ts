import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E3-6 · accesibilidad. AC: axe-core sin errores críticos. Además verifica los
// atajos §5 (Space/←→/F/1–5) y que el idioma del documento se anota (lang).

test.describe("E3-6 · accesibilidad", () => {
  test("axe-core no reporta violaciones críticas ni serias", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    // mensaje legible si algo falla
    const detail = blocking.flatMap((v) =>
      v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")} — ${n.failureSummary}`),
    );
    expect(detail).toEqual([]);
  });

  test("el documento anota el idioma y lo actualiza al cambiar de locale", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.locator("#langSel").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("atajos de teclado §5: capas (1–5), encuadrar (F) y scrub (←→)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    // la tecla «1» conmuta la capa de huella
    await expect(page.locator("#layFootprint")).toBeChecked();
    await page.locator("#viewport").click();
    await page.keyboard.press("1");
    await expect(page.locator("#layFootprint")).not.toBeChecked();
    await page.keyboard.press("1");
    await expect(page.locator("#layFootprint")).toBeChecked();

    // ←→ mueven el deslizador de reproducción
    const scrub = page.locator("#scrub");
    await expect(scrub).toHaveValue("0");
    await page.keyboard.press("ArrowRight");
    await expect(scrub).not.toHaveValue("0");
    await page.keyboard.press("ArrowLeft");
    await expect(scrub).toHaveValue("0");
  });
});
