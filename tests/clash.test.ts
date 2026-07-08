// Golden de clash + import DXF/CSV (docs/ENGINE_NOTES.md §4.2, última fila).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import engine, { type Vehicle } from "./_engine";

const demos = dirname(fileURLToPath(import.meta.url)) + "/../demos";
function demo(name: string): string {
  return readFileSync(resolve(demos, name), "utf8");
}
function urbos5(): Vehicle {
  return structuredClone(engine.VEHICLE_PRESETS.find((p) => p.id === "urbos5")!.vehicle);
}

describe("import DXF del trazado 1 y encadenado", () => {
  it("parsea y encadena en un eje continuo ~99 m", () => {
    const { chains, warnings } = engine.parseDXF(demo("trazado_1_R25_clotoides.dxf"));
    expect(chains.length).toBeGreaterThan(0);
    expect(Array.isArray(warnings)).toBe(true);
    const { points } = engine.joinChains(chains);
    expect(points).not.toBeNull();
    const track = engine.trackFromPoints(points!);
    expect(track.length).toBeGreaterThan(95);
    expect(track.length).toBeLessThan(103);
  });
});

describe("§4.2 clash demo — obstaculos_demo_trazado1.dxf", () => {
  it("margen mín kin ≈ −167 mm @ PK≈52; solo geo ≈ +50 mm", () => {
    const { points } = engine.joinChains(
      engine.parseDXF(demo("trazado_1_R25_clotoides.dxf")).chains,
    );
    const track = engine.trackFromPoints(points!);
    const { obstacles } = engine.obstaclesFromDXF(demo("obstaculos_demo_trazado1.dxf"));
    expect(obstacles.length).toBeGreaterThan(0);

    const kin = engine.defaultKin();
    kin.enabled = true;
    const swKin = engine.runSweep(track, urbos5(), { step: 0.2, kin });
    const clashKin = engine.clashCheck(track, swKin, obstacles, 0.05);
    expect(clashKin.minMargin).not.toBeNull();
    expect(Math.abs(clashKin.minMargin! - -0.167)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(clashKin.minAt!.pk - 52)).toBeLessThanOrEqual(2.5);

    const swGeo = engine.runSweep(track, urbos5(), { step: 0.2 });
    const clashGeo = engine.clashCheck(track, swGeo, obstacles, 0.05);
    expect(Math.abs(clashGeo.minMargin! - 0.05)).toBeLessThanOrEqual(0.03);
  });
});

describe("peralte por tabla CSV equivalente a la ley (§4.2: total 3.487)", () => {
  it("parsea el CSV demo y produce ancho kin ≈ 3.487", () => {
    const table = engine.parseCantCSV(demo("peralte_demo_trazado1.csv"));
    expect(table).not.toBeNull();
    const { points } = engine.joinChains(
      engine.parseDXF(demo("trazado_1_R25_clotoides.dxf")).chains,
    );
    const track = engine.trackFromPoints(points!);
    const kin = engine.defaultKin();
    kin.enabled = true;
    kin.cantTable = table!;
    const sw = engine.runSweep(track, urbos5(), { step: 0.2, kin });
    expect(Math.abs(sw.summary!.kinTotalWidth - 3.487)).toBeLessThanOrEqual(0.01);
  });
});
