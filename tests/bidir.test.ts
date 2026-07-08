// ============================================================================
// E2-5 — Marcha bidireccional: unión de envolventes ida + vuelta.
//  · Vehículo simétrico → la vuelta no añade nada (diferencia < 2 mm).
//  · Vehículo asimétrico → el informe indica el sentido pésimo por PK (rowDir).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";

function cloneVehicle(id: string): Vehicle {
  return structuredClone(engine.VEHICLE_PRESETS.find((p) => p.id === id)!.vehicle);
}

describe("§E2-5 marcha bidireccional", () => {
  it("vehículo simétrico (urbos5/R25): |bidir − ida| < 2 mm", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const fwd = engine.runSweep(track, cloneVehicle("urbos5"), { step: 0.25 });
    const bi = engine.runSweep(track, cloneVehicle("urbos5"), { step: 0.25, both: true });
    expect(fwd.summary!.bidirectional).toBe(false);
    expect(bi.summary!.bidirectional).toBe(true);
    expect(Math.abs(bi.summary!.totalWidth - fwd.summary!.totalWidth)).toBeLessThan(0.002);
  });

  it("vehículo simétrico en contracurva (scurve): sigue < 2 mm", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "scurve")!.build();
    const fwd = engine.runSweep(track, cloneVehicle("urbos5"), { step: 0.25 });
    const bi = engine.runSweep(track, cloneVehicle("urbos5"), { step: 0.25, both: true });
    expect(Math.abs(bi.summary!.totalWidth - fwd.summary!.totalWidth)).toBeLessThan(0.002);
  });

  it("vehículo asimétrico: la vuelta gobierna algunos PK (rowDir con ambos sentidos)", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const v = cloneVehicle("urbos5");
    v.modules[0]!.pivotFromFront = 0.5; // bogie de cabeza fuertemente asimétrico
    const bi = engine.runSweep(track, v, { step: 0.25, both: true });
    const dir = bi.rowDir!;
    expect(dir.length).toBe(bi.rows!.length);
    const nRev = dir.reduce((a, b) => a + b, 0);
    expect(nRev).toBeGreaterThan(0); // hay PKs donde la vuelta es la pésima
    expect(nRev).toBeLessThan(dir.length); // y otros donde manda la ida
  });

  it("la ida no expone rowDir (undefined) para no confundir el reporting", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const fwd = engine.runSweep(track, cloneVehicle("urbos5"), { step: 0.25 });
    expect(fwd.rowDir).toBeUndefined();
  });
});
