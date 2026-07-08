// ============================================================================
// E2-7 — Perfiles de velocidad: insuficiencia real I(s) = B·v²·k − D(s).
//  · Parser CSV pk;v_kmh → m/s.
//  · AC: con v igual a la velocidad de equilibrio (I=0 en toda la curva), la
//    envolvente exterior cinemática coincide con la de I=0 global (iMax=0).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type KinRules, type Vehicle } from "./_engine";

const G = 9.81;

function rigidModuleVehicle(): Vehicle {
  return {
    wheelbase: 6,
    mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
    modules: [
      {
        id: "R",
        type: "bogie",
        bogieType: "rigido",
        length: 9,
        width: 2.65,
        pivotFromFront: 4.5,
        wheelbase: 6,
        jointFrontOff: 0,
        jointRearOff: 0,
      },
    ],
    joints: [],
  };
}

// Arco puro R25 con rectas de arranque (D=0 en recta, D=dMax en el arco pleno).
const R = 25;
const track = engine.trackFromSegments([
  ["straight", 8],
  ["arc", (R * Math.PI) / 2, 1 / R],
  ["straight", 8],
]);

function baseKin(): KinRules {
  return { ...engine.defaultKin(), enabled: true };
}

describe("§E2-7 perfiles de velocidad", () => {
  it("parseSpeedCSV convierte km/h a m/s y ordena por pk", () => {
    const t = engine.parseSpeedCSV("0;36\n100;72\n50;54")!;
    expect(t).not.toBeNull();
    expect(t.length).toBe(3);
    expect(t[0][0]).toBe(0);
    expect(t[0][1]).toBeCloseTo(10, 6); // 36 km/h = 10 m/s
    expect(t[1][0]).toBe(50);
    expect(t[2][1]).toBeCloseTo(20, 6); // 72 km/h = 20 m/s
  });

  it("v = velocidad de equilibrio (I=0) ≡ envolvente exterior de I=0 global", () => {
    // D en el arco pleno = dMax (c=min(1,k·rFull)=min(1,30/25)=1). B = e/g.
    const kin = baseKin();
    const e = kin.e;
    const dMax = kin.dMax;
    const B = e / G;
    // velocidad de equilibrio en el arco: B·v²·k = D → v = sqrt(D·R/B).
    const vEq = Math.sqrt((dMax * R) / B); // m/s
    // perfil constante = vEq (en el arco I=0; en recta k=0 y D=0 ⇒ I=0 también).
    const kinSpeed: KinRules = {
      ...kin,
      speedTable: [
        [0, vEq],
        [track.length, vEq],
      ],
    };

    // Baseline I=0 global: sin insuficiencia ni exceso (iMax=0, no detenido).
    const kinZero: KinRules = { ...kin, iMax: 0, stopped: false };

    const swSpeed = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
      kin: kinSpeed,
    });
    const swZero = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
      kin: kinZero,
    });

    expect(swSpeed.summary!.kinEnabled).toBe(true);
    // exterior cinemática (lado alto) idéntica dentro de la discretización.
    expect(Math.abs(swSpeed.summary!.kinMaxRight - swZero.summary!.kinMaxRight)).toBeLessThan(1e-6);
    expect(Math.abs(swSpeed.summary!.kinMaxLeft - swZero.summary!.kinMaxLeft)).toBeLessThan(1e-6);
  });

  it("v mayor que la de equilibrio aumenta la insuficiencia → más sobreancho exterior", () => {
    const kin = baseKin();
    const B = kin.e / G;
    const vEq = Math.sqrt((kin.dMax * R) / B);
    const slow: KinRules = {
      ...kin,
      speedTable: [
        [0, vEq],
        [track.length, vEq],
      ],
    };
    // 4·vEq: la insuficiencia (I = 15·D) supera el término geométrico de peralte
    // hh·D/e y empuja la envolvente exterior más allá del caso de equilibrio.
    const fast: KinRules = {
      ...kin,
      speedTable: [
        [0, vEq * 4],
        [track.length, vEq * 4],
      ],
    };
    const swSlow = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
      kin: slow,
    });
    const swFast = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
      kin: fast,
    });
    // más velocidad ⇒ mayor insuficiencia ⇒ mayor envolvente cinemática total.
    expect(swFast.summary!.kinTotalWidth).toBeGreaterThan(swSlow.summary!.kinTotalWidth);
  });
});
