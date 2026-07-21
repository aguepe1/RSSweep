// ============================================================================
// ROBUSTEZ — entrada degenerada. El motor debe fallar con un mensaje claro (o
// devolver `{error}`), nunca con un crash o un NaN silencioso (Fase 0 del ROADMAP).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle, type Track } from "./_engine";

function cloneVehicle(id: string): Vehicle {
  const preset = engine.VEHICLE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`vehicle preset ${id} not found`);
  return structuredClone(preset.vehicle);
}
function buildTrack(id: string): Track {
  return engine.TRACK_PRESETS.find((p) => p.id === id)!.build();
}

describe("runSweep — guardas de entrada degenerada", () => {
  it("vehículo sin módulos devuelve error (no −Infinity ni crash)", () => {
    const track = buildTrack("r25");
    const v = cloneVehicle("urbos5");
    v.modules = [];
    v.joints = [];
    const sw = engine.runSweep(track, v);
    expect(sw.error, "debe reportar error").toBeTruthy();
    expect(sw.summary).toBeUndefined();
  });

  it("un vehículo válido sobre un trazado válido NO reporta error (control)", () => {
    const sw = engine.runSweep(buildTrack("r25"), cloneVehicle("urbos5"), { step: 0.5 });
    expect(sw.error).toBeUndefined();
    expect(sw.summary).toBeTruthy();
    expect(Number.isFinite(sw.summary!.totalWidth)).toBe(true);
  });
});

describe("trackFromPoints / makeTrack — geometría degenerada", () => {
  it("lista vacía lanza error claro", () => {
    expect(() => engine.trackFromPoints([])).toThrow();
  });
  it("un solo punto lanza error claro", () => {
    expect(() => engine.trackFromPoints([[1, 1]])).toThrow();
  });
  it("puntos todos coincidentes (dedup → 1 vértice) lanza error claro", () => {
    expect(() =>
      engine.trackFromPoints([
        [2, 2],
        [2, 2],
        [2, 2],
      ]),
    ).toThrow();
  });
  it("makeTrack con una sola estación lanza error claro", () => {
    expect(() =>
      engine.makeTrack(Float64Array.from([0]), Float64Array.from([0]), Float64Array.from([0])),
    ).toThrow();
  });
  it("un segmento de longitud cero no produce NaN (posición finita)", () => {
    // Estación coincidente s=[0,0,1]: la guarda de segmento evita la división por cero.
    const tr = engine.makeTrack(
      Float64Array.from([0, 0, 1]),
      Float64Array.from([0, 1, 2]),
      Float64Array.from([0, 0, 0]),
    );
    for (const sv of [0, 0.5, 1]) {
      const p = tr.pos(sv);
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), `pos(${sv}) finita`).toBe(true);
    }
  });
});
