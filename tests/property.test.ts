// Property tests básicos requeridos por E1-3.
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";
import type { Vec2 } from "../src/types";

// Vehículo longitudinal y lateralmente simétrico (sin espejos): bogie–susp–bogie
// con pivotes reflejados (C1 a 2.5 del frente; C3 a length−2.5 = 4.5).
function symVehicle(): Vehicle {
  return {
    wheelbase: 1.85,
    mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
    modules: [
      {
        id: "C1",
        type: "bogie",
        length: 7,
        width: 2.65,
        pivotFromFront: 2.5,
        jointFrontOff: 0,
        jointRearOff: 0,
      },
      { id: "S2", type: "suspendido", length: 6, width: 2.65 },
      {
        id: "C3",
        type: "bogie",
        length: 7,
        width: 2.65,
        pivotFromFront: 4.5,
        jointFrontOff: 0,
        jointRearOff: 0,
      },
    ],
    joints: [engine.defaultJoint(), engine.defaultJoint()],
  };
}

describe("propiedad: huella simétrica en recta con vehículo simétrico", () => {
  it("en recta pura, izq ≈ dcha ≈ semiancho del cuerpo", () => {
    const track = engine.trackFromSegments([["straight", 60]]);
    const sw = engine.runSweep(track, symVehicle(), { step: 0.25 });
    const s = sw.summary!;
    expect(Math.abs(s.maxLeft - s.maxRight)).toBeLessThanOrEqual(0.001);
    expect(s.maxLeft).toBeCloseTo(2.65 / 2, 3);
  });
});

describe("propiedad: envolvente invariante al sentido de recorrido (sin obstáculos)", () => {
  it("recorrer el trazado 1 al revés da el mismo ancho total (vehículo simétrico)", () => {
    const fwd = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const pts: Vec2[] = [];
    for (let s = 0; s <= fwd.length + 1e-9; s += 0.1) pts.push(fwd.pos(s));
    const rev = engine.trackFromPoints(pts.slice().reverse());

    const swF = engine.runSweep(fwd, symVehicle(), { step: 0.25 });
    const swR = engine.runSweep(rev, symVehicle(), { step: 0.25 });
    expect(Math.abs(swF.summary!.totalWidth - swR.summary!.totalWidth)).toBeLessThanOrEqual(0.003);
  });
});
