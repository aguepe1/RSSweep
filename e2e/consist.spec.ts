import { test, expect, type Page } from "@playwright/test";

// Dos trenes acoplados (consist + enganche). Es UI sobre state.consist; el barrido
// efectivo lo ensambla controller.run() con buildConsist. No toca el motor.

type BarridoWin = {
  __barrido: {
    state: {
      consist: { enabled: boolean; coupler: { type: string; length: number } };
      sweep: { steps: { polys: { kind: string }[] }[] } | null;
    };
  };
};

const bodies = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as BarridoWin).__barrido.state.sweep;
    return s ? s.steps[0].polys.filter((p) => p.kind === "body").length : 0;
  });

test.describe("consist · dos trenes acoplados", () => {
  test("activar el acople añade la barra + el 2.º tren y lo anota en el cajetín", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    const before = await bodies(page); // 5 cuerpos (urbos5)
    expect(before).toBe(5);

    await page.locator("#consistEnabled").check();
    // el barrido recalcula sobre A ▸ barra ▸ B ⇒ 5 + 1 (barra) + 5 = 11 cuerpos
    await expect.poll(() => bodies(page)).toBe(11);
    // el cajetín anota el enganche
    await expect(page.locator("#cartTable")).toContainText("Enganche");
    await expect(page.locator("#cartTable")).toContainText("Articulado");
  });

  test("cambiar el tipo/longitud del enganche recalcula", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#consistEnabled").check();
    await expect.poll(() => bodies(page)).toBe(11);

    await page.locator("#couplerType").selectOption("rigido");
    await page.locator("#couplerLength").fill("2.5");
    await page.locator("#couplerLength").blur();
    await expect(page.locator("#cartTable")).toContainText("Rígido");
    await expect(page.locator("#cartTable")).toContainText("2,50 m");
    const st = await page.evaluate(() => (window as unknown as BarridoWin).__barrido.state.consist);
    expect(st.enabled).toBe(true);
    expect(st.coupler.type).toBe("rigido");
    expect(st.coupler.length).toBeCloseTo(2.5, 3);
  });

  test("desactivar el acople vuelve a un solo tren", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#consistEnabled").check();
    await expect.poll(() => bodies(page)).toBe(11);
    await page.locator("#consistEnabled").uncheck();
    await expect.poll(() => bodies(page)).toBe(5);
    await expect(page.locator("#cartTable")).not.toContainText("Enganche");
  });
});
