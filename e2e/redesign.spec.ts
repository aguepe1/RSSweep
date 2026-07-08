import { test, expect } from "@playwright/test";

// E3-1 · rediseño «mesa de delineación digital»: tablas densas en vez de tarjetas
// (módulos y rótulas) y barra de ángulo máx proporcional al límite por rótula.

test.describe("E3-1 · tablas de módulos y rótulas", () => {
  test("los módulos se renderizan como tabla densa con fila de totales", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // #modules es ahora una tabla; un tbody.mod por módulo (preset de 5)
    await expect(page.locator("#modules table.dtable.mtable")).toHaveCount(1);
    await expect(page.locator("#modules tbody.mod")).toHaveCount(5);
    // fila de totales con la suma de longitudes
    await expect(page.locator("#modules tfoot")).toContainText("5 módulos");
    await expect(page.locator("#modules tfoot")).toContainText("Σ longitud");
    // los selectores heredados siguen resolviendo dentro de la tabla
    await expect(page.locator('#modules .mod select[data-f="cabShape"]').first()).toBeVisible();
  });

  test("las rótulas se renderizan como tabla con barra de ángulo y PK crítico", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await expect(page.locator("#joints table.dtable.jtable")).toHaveCount(1);
    // una fila .joint por rótula (5 módulos → 4 rótulas) con su selector de tipo
    const joints = page.locator("#joints .joint");
    await expect(joints).toHaveCount(4);
    await expect(joints.first().locator('select[data-f="type"]')).toBeVisible();
    // tras el cálculo, la barra de ángulo tiene ancho > 0 y el PK crítico se anota
    const firstBar = joints.first().locator(".abar > span");
    const width = await firstBar.evaluate((el) => (el as HTMLElement).style.width);
    expect(parseFloat(width)).toBeGreaterThan(0);
    await expect(joints.first().locator(".angcap")).toContainText("@ PK");
  });

  test("un límite de giro insuficiente marca la rótula excedida en rojo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // fija un límite imposible en la primera rótula y recalcula
    const limInput = page.locator("#joints .joint").first().locator('input[data-f="maxAngleDeg"]');
    await limInput.fill("1");
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#btnRun").click();
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    // la fila queda marcada como excedida y su barra en color de invasión
    const first = page.locator("#joints .joint").first();
    await expect(first).toHaveClass(/exceeded/);
    await expect(first.locator(".abar")).toHaveClass(/over/);
  });

  test("el esquema a escala dibuja una silueta por módulo y sigue al añadir uno", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    // el SVG del esquema existe y tiene una silueta (mod-shape) por módulo (preset de 5)
    await expect(page.locator("#schematic svg")).toHaveCount(1);
    await expect(page.locator("#schematic .mod-shape")).toHaveCount(5);
    // al añadir un módulo el esquema se redibuja con una silueta más
    await page.locator("#btnAddMod").click();
    await expect(page.locator("#modules tbody.mod")).toHaveCount(6);
    await expect(page.locator("#schematic .mod-shape")).toHaveCount(6);
  });
});

// E3-1 · 1D layout §4: barra de menú desplegable, panel de entrada en pestañas y
// barra de estado que se puebla tras el cálculo.
test.describe("E3-1 · layout §4 (menú + pestañas + barra de estado)", () => {
  test("las pestañas conmutan el contenido del panel de entrada", async ({ page }) => {
    await page.goto("/");
    // arranca en la pestaña Vehículo: la tabla de módulos es visible, el trazado no
    await expect(page.locator('.tabpanel[data-tab="veh"]')).toBeVisible();
    await expect(page.locator("#trackPreset")).toBeHidden();
    await expect(page.locator("#btnRun")).toBeHidden();
    // conmutar a Trazado muestra sus controles y oculta los de Vehículo
    await page.locator('.tab[data-tab="track"]').click();
    await expect(page.locator("#trackPreset")).toBeVisible();
    await expect(page.locator("#modules")).toBeHidden();
    // conmutar a Reglas muestra el botón de cálculo
    await page.locator('.tab[data-tab="reglas"]').click();
    await expect(page.locator("#btnRun")).toBeVisible();
  });

  test("la barra de menú abre desplegables y actúa sobre botones existentes", async ({ page }) => {
    await page.goto("/");
    // el menú Informes despliega opciones que delegan en los botones de export
    const informes = page.locator(".mitem", { hasText: "Informes" });
    await informes.locator(".mbtn").click();
    await expect(informes.locator(".mdrop")).toBeVisible();
    await expect(page.locator("#menuCsvOut")).toBeVisible();
    // el item Vehículo de la barra activa la pestaña Vehículo
    await page.locator('.mbtn[data-tab="track"]').click();
    await expect(page.locator("#trackPreset")).toBeVisible();
  });

  test("la barra de estado se puebla con versión, pasos y tiempo tras el cálculo", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    await expect(page.locator("#statusBarVersion")).toContainText("v0.4.0");
    await expect(page.locator("#statusBarSteps")).toContainText("pasos");
    await expect(page.locator("#statusBarTime")).toContainText("ms");
    await expect(page.locator("#statusBarHyp")).toContainText("geométrica");
  });
});
