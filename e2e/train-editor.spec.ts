import { test, expect, type Page } from "@playwright/test";

// E4-B6 · Editor interactivo del tren (overlay a pantalla completa). Es solo UI
// sobre state.vehicle: arrastrar bogies, ventanas de bogie/fuelle/caja con «aplicar
// a todos», añadir caja. Todo se sincroniza con las tablas de la izquierda y con el
// barrido. No toca el motor ni los dorados (cubierto por los tests unitarios).

type BarridoWin = {
  __barrido: {
    state: { vehicle: { modules: Record<string, unknown>[]; joints: Record<string, unknown>[] } };
  };
};

const veh = (page: Page) =>
  page.evaluate(() => (window as unknown as BarridoWin).__barrido.state.vehicle);

test.describe("E4-B6 · editor interactivo del tren", () => {
  test("«Editar tren…» abre el overlay; Esc y ✕ lo cierran", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    await page.locator("#btnEditTrain").click();
    await expect(page.locator("#trainEditor")).toBeVisible();
    await expect(page.locator("#trainCanvas svg")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("#trainEditor")).toBeHidden();

    await page.locator("#btnEditTrain").click();
    await expect(page.locator("#trainEditor")).toBeVisible();
    await page.locator("#btnCloseTrain").click();
    await expect(page.locator("#trainEditor")).toBeHidden();
  });

  test("arrastrar un bogie cambia su pivote y se refleja en la tabla", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    const bogie = page.locator('#trainCanvas .te-bogie[data-mod="0"][data-piv="single"]');
    await expect(bogie).toBeVisible();
    const before = (await veh(page)).modules[0].pivotFromFront as number;

    const box = (await bogie.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy, { steps: 8 });
    await page.mouse.up();

    const after = (await veh(page)).modules[0].pivotFromFront as number;
    expect(after).not.toBeCloseTo(before, 2);
    // la tabla de módulos refleja el nuevo pivote
    const cell = page.locator('#modules tbody.mod input[data-f="pivotFromFront"]').first();
    await expect(cell).toHaveValue(String(after));
  });

  test("clic en un fuelle abre la ventana y «aplicar a todas» iguala las rótulas", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    await page.locator('#trainCanvas .te-fuelle[data-joint="0"]').click();
    const pop = page.locator("#trainPopover");
    await expect(pop).toBeVisible();

    // cambiar el hueco de esta rótula y aplicarlo a todas
    await pop.locator('input[data-f="gap"]').fill("0.55");
    await pop.locator('input[data-f="gap"]').press("Enter");
    // la ventana se reabre tras el commit; pulsar «aplicar a todas»
    await page.locator('#trainPopover [data-a="applyJoints"]').click();

    const joints = (await veh(page)).joints;
    expect(joints.length).toBeGreaterThan(1);
    for (const j of joints) expect(j.gap).toBeCloseTo(0.55, 3);
  });

  test("«Añadir caja» aumenta el número de módulos y de cajas dibujadas", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    const before = await page.locator("#trainCanvas .te-car").count();
    await page.locator("#btnAddCaja").click();
    await expect(page.locator("#trainCanvas .te-car")).toHaveCount(before + 1);
    // la tabla de módulos también crece
    await expect(page.locator("#modules tbody.mod")).toHaveCount(before + 1);
  });

  test("ventana de caja: cambiar ancho + «aplicar a todas» iguala el ancho", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    await page.locator('#trainCanvas .te-car[data-car="1"]').click();
    const pop = page.locator("#trainPopover");
    await expect(pop).toBeVisible();
    await pop.locator('input[data-f="width"]').fill("2.4");
    await pop.locator('input[data-f="width"]').press("Enter");
    await page.locator('#trainPopover [data-a="applyWidth"]').click();

    const mods = (await veh(page)).modules;
    for (const m of mods) expect(m.width).toBeCloseTo(2.4, 3);
  });

  test("«Guardar cambios» de la ventana de caja la cierra (confirma el paso)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    await page.locator('#trainCanvas .te-car[data-car="1"]').click();
    const pop = page.locator("#trainPopover");
    await expect(pop).toBeVisible();
    await expect(pop.locator('[data-a="save"]')).toBeVisible();
    await pop.locator('[data-a="save"]').click();
    await expect(pop).toBeHidden();
  });

  test("pulsar la cota de longitud abre un editor inline y cambia la longitud", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    const before = (await veh(page)).modules[0].length as number;
    await page.locator('#trainCanvas .te-dim[data-dim="length"][data-idx="0"]').click();
    const edit = page.locator(".te-dim-edit");
    await expect(edit).toBeVisible();
    await edit.fill(String(before + 1));
    await edit.press("Enter");
    await expect(edit).toBeHidden();

    const after = (await veh(page)).modules[0].length as number;
    expect(after).toBeCloseTo(before + 1, 3);
    // la tabla de módulos refleja la nueva longitud
    await expect(page.locator('#modules tbody.mod input[data-f="length"]').first()).toHaveValue(
      String(after),
    );
  });

  test("el preset de vehículo del editor recarga el tren", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await page.locator("#btnEditTrain").click();

    // elegir un preset distinto del activo (índice 0)
    await page.locator("#tePreset").selectOption("1");
    // el select del panel de entrada queda sincronizado
    await expect(page.locator("#vehPreset")).toHaveValue("1");
    const after = (await veh(page)).modules.length;
    expect(after).toBeGreaterThan(0);
    // el dibujo se rehace con las cajas del nuevo preset
    await expect(page.locator("#trainCanvas .te-car")).toHaveCount(after);
  });
});
