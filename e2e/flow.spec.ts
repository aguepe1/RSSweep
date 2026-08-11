import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const demoTrack = resolve(here, "../demos/trazado_1_R25_clotoides.dxf");
const demoLandxml = resolve(here, "../demos/alignment_demo_staStart1000.landxml");
const demoSpline = resolve(here, "../demos/eje_civil3d_spline_mm.dxf");

test.describe("flujo: arranque → importar DXF → calcular → exportar", () => {
  test("arranca offline y calcula el preset por defecto", async ({ page }) => {
    await page.goto("/");
    // el cajetín muestra la versión y el ancho total dorado del trazado 1
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
    await expect(page.locator("#cartTable")).toContainText("3,244");
    // la versión aparece en la cabecera y en el cajetín (E1-4)
    await expect(page.locator("#appSub")).toContainText("v0.5.0");
    await expect(page.locator("#cartDate")).toContainText("v0.5.0");
    // los botones de export se habilitan tras el cálculo
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    await expect(page.locator("#btnDxfOut")).toBeEnabled();
  });

  test("importa un trazado DXF y recalcula", async ({ page }) => {
    await page.goto("/");
    await page.locator("#fileDxf").setInputFiles(demoTrack);
    await expect(page.locator("#trackInfo")).toContainText("trazado_1_R25_clotoides.dxf");
    await expect(page.locator("#trackInfo")).toContainText("entidad(es)");
    // recalcula: el cajetín sigue mostrando un ancho total
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
  });

  test("exporta el perfil CSV con metadatos de versión", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnCsvOut").click(),
    ]);
    expect(download.suggestedFilename()).toBe("perfil_semianchos.csv");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    // primera línea = metadato de versión; luego la cabecera de columnas
    expect(text).toContain("BARRIDO 0.5.0");
    expect(text).toContain("pk_m;offset_dcha_m;offset_izq_m;ancho_m");
  });

  test("exporta la huella DXF con comentario de versión (grupo 999)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#btnDxfOut")).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnDxfOut").click(),
    ]);
    expect(download.suggestedFilename()).toBe("huella_barrida.dxf");
    const path = await download.path();
    const text = readFileSync(path, "utf8");
    expect(text.startsWith("999")).toBeTruthy();
    expect(text).toContain("BARRIDO 0.5.0");
  });
});

test.describe("E2-1 · barrido en Web Worker (progreso + cancelación)", () => {
  test("el barrido bisectriz del bucle R20 muestra barra de progreso y es cancelable", async ({
    page,
  }) => {
    await page.goto("/");
    // esperar a que termine el cálculo por defecto (worker) antes de reconfigurar
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // trazado bucle terminal R20 (índice 1) — dispara un recálculo automático
    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#trackPreset").selectOption("1");

    // poner las rótulas en bisectriz: el solver de equilibrio es lento, así que
    // el barrido dura lo suficiente para observar el progreso y cancelarlo.
    // Rótulas y fuelles viven ahora en la pestaña Vehículo (E4-B5).
    await page.locator('.tab[data-tab="veh"]').click();
    const jointCount = await page.locator("#joints .joint").count();
    for (let i = 0; i < jointCount; i++) {
      await page
        .locator("#joints .joint")
        .nth(i)
        .locator('select[data-f="type"]')
        .selectOption("bisectriz");
    }

    // lanzar el cálculo pesado: la barra de progreso aparece de inmediato
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#btnRun").click();
    await expect(page.locator("#progressWrap")).toBeVisible();

    // la UI responde durante el cálculo (no está congelada): cancelar funciona
    await page.locator("#btnCancel").click();
    await expect(page.locator("#progressWrap")).toBeHidden();
    await expect(page.locator("#status")).toContainText("Cálculo cancelado");
  });
});

test.describe("E2-5 · marcha bidireccional (unión ida + vuelta)", () => {
  test("activar 'ambos sentidos' recalcula y anota el sentido en el cajetín y el CSV", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // activar el análisis bidireccional dispara un recálculo automático
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#bothDirs").check();
    await expect(page.locator("#cartTable")).toContainText("Sentido de análisis");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // el CSV incluye la columna 'sentido' con etiquetas ida/vuelta
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnCsvOut").click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    expect(text).toContain(";sentido");
    expect(text).toMatch(/;(ida|vuelta)\b/);
  });
});

test.describe("E2-6 · contornos de módulo (testero achaflanado)", () => {
  test("achaflanar la cabina expone los campos de chaflán y recalcula sin error", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // el primer módulo es cabina de cabecera: cambiar su testero a chaflán
    const cabSel = page.locator('#modules .mod select[data-f="cabShape"]').first();
    await expect(cabSel).toHaveValue("recto");
    await cabSel.selectOption("chaflan");

    // aparecen los campos de profundidad y anchura del chaflán con valores válidos
    const dEl = page.locator('#modules .mod input[data-f="chamD"]').first();
    const wEl = page.locator('#modules .mod input[data-f="chamW"]').first();
    await expect(dEl).toBeVisible();
    await expect(wEl).toBeVisible();
    expect(Number(await dEl.inputValue())).toBeGreaterThan(0);

    // recalcular sigue produciendo un barrido válido (export habilitado, sin error)
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#btnRun").click();
    await expect(page.locator("#btnCsvOut")).toBeEnabled();
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
  });
});

test.describe("E2-7 · perfiles de velocidad (insuficiencia real)", () => {
  test("importar un CSV pk;v_kmh anota la tabla y recalcula sin error", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // la cinemática (y su importador de velocidad) vive tras el toggle "Activar"
    await page.locator('.tab[data-tab="reglas"]').click();
    await page.locator("#kinEnabled").check();
    const speedInfo = page.locator("#speedInfo");

    // cargar un perfil de velocidad por PK: sustituye la insuficiencia heurística
    await page.locator("#fileSpeed").setInputFiles({
      name: "vel.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("0;18\n50;36\n99;18"),
    });
    await expect(speedInfo).toContainText("3 puntos");
    await expect(speedInfo).toContainText("insuficiencia real");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // pulsar la línea de información retira el perfil (vuelve a la ley heurística)
    await speedInfo.click();
    await expect(speedInfo).toHaveText("");
  });
});

test.describe("E2-4 · import LandXML (PK de proyecto)", () => {
  test("un alignment con staStart≠0 muestra PKs de proyecto en cajetín y CSV", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // importar el alignment demo (staStart=1000 + ecuación de PK a 2000)
    await page.locator("#fileLandxml").setInputFiles(demoLandxml);
    await expect(page.locator("#trackInfo")).toContainText("PK inicio 1000");
    // esperar a que el recálculo (worker) reproyecte el cajetín sobre el eje nuevo
    await expect(page.locator("#cartTable")).toContainText("alignment_demo");

    // el cajetín muestra PKs de proyecto (≥ 1000), no la abscisa de arco (< 100)
    const cart = await page.locator("#cartTable").textContent();
    expect(cart).toMatch(/PK 1\d{3}/);

    // el CSV de perfil arranca en el PK de proyecto (primer dato ≥ 1000)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnCsvOut").click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    const dataLine = text.split("\n").find((l) => /^\d/.test(l))!;
    expect(parseFloat(dataLine.split(";")[0])).toBeGreaterThanOrEqual(1000);
  });
});

test.describe("E2-3 · DXF industrial (SPLINE/NURBS, $INSUNITS, capa del eje, flip)", () => {
  test("importa un export estilo Civil 3D: SPLINE en mm, elige capa e invierte sentido", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#btnCsvOut")).toBeEnabled();

    // export con dos capas (C-ROAD-CNTR + C-ANNO-TEXT) y dibujo en milímetros
    await page.locator('.tab[data-tab="track"]').click();
    await page.locator("#fileDxf").setInputFiles(demoSpline);
    await expect(page.locator("#trackInfo")).toContainText("eje_civil3d_spline_mm.dxf");
    // el aviso de conversión de unidades mm→m aparece en la UI
    await expect(page.locator("#trackWarnings")).toContainText("metros");
    // el selector de capa del eje se muestra al haber más de una capa
    await expect(page.locator("#dxfLayerRow")).toBeVisible();
    await expect(page.locator("#dxfFlipRow")).toBeVisible();

    // seleccionar la capa de centro de vía como eje y comprobar recálculo
    await page.locator("#dxfLayer").selectOption("C-ROAD-CNTR");
    await expect(page.locator("#trackInfo")).toContainText("capa C-ROAD-CNTR");
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");

    // invertir el sentido de marcha: el trazado se recalcula sin error
    await page.locator("#dxfFlip").check();
    await expect(page.locator("#cartTable")).toContainText("Ancho total barrido");
  });
});
