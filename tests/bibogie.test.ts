// ============================================================================
// E4-B2 — VALORES DORADOS del módulo «coche de dos bogies» (biBogie).
// Cuerpo rígido sobre DOS pivotes de bogie. Cada pivote se ancla en el punto medio
// de la cuerda de su propio empate (retranqueo p²/8R hacia el interior de la curva,
// como el bogie rígido); el rumbo de la caja es la cuerda entre ambos pivotes y el
// pivote trasero se resuelve del vínculo de rigidez |P(s_f) − P(s_r)| = a.
//
// Derivación analítica (círculo puro R=25, empate p=1.85, a=9.0, b=1.275, n_a=2.5):
//   Rp = √(R²−p²/4)        = 24.982882   (radio del centro de cada bogie)
//   Rm = √(Rp²−a²/4)       = 24.574262   (radio de la cuerda entre pivotes)
//   interior = b + (R−Rm)  = 1.700738    (semiancho interior máx)
//   exterior = √((Rm+b)²+(a/2+n_a)²) − R = 1.780300  (semiancho exterior máx)
//   retranqueo pivote = p²/8R = 17.1 mm
//   s_f − s_r (arco) > cuerda a = 9.0    (el arco es más largo que la cuerda)
// Estos dorados son PROPIOS de B2; los 19 dorados existentes NO cambian.
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle, type Track } from "./_engine";

function near(actual: number, expected: number, tol: number, msg?: string): void {
  expect(
    Math.abs(actual - expected),
    `${msg ?? ""} got ${actual}, want ${expected}±${tol}`,
  ).toBeLessThanOrEqual(tol);
}

const TOL_MM = 0.002; // 2 mm

/** Coche de dos bogies de validación: L=14, ancho 2.55, pivotes 2.50 y 11.50. */
function biBogieVehicle(): Vehicle {
  return {
    wheelbase: 1.85,
    mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
    modules: [
      {
        id: "K",
        type: "biBogie",
        length: 14.0,
        width: 2.55,
        pivotFrontFromFront: 2.5,
        pivotRearFromFront: 11.5,
        wheelbase: 1.85,
        jointFrontOff: 0,
        jointRearOff: 0,
      },
    ],
    joints: [],
  };
}

/** Círculo puro R con rectas de entrada/salida largas para el arranque estable. */
function arcTrack(R: number): Track {
  return engine.trackFromSegments([
    ["straight", 15],
    ["arc", (R * Math.PI) / 2, 1 / R],
    ["straight", 15],
  ]);
}

describe("§4.4 validación analítica — coche de dos bogies en círculo R25", () => {
  const track = arcTrack(25);
  const opts = { step: 0.1, stationStep: 0.1, edgeStep: 0.1 };

  it("interior = 1.7007 (b + (R−Rm))", () => {
    const sw = engine.runSweep(track, biBogieVehicle(), opts);
    expect(sw.error).toBeUndefined();
    near(sw.summary!.maxLeft, 1.7007, TOL_MM, "interior");
  });

  it("exterior = 1.7803 (radial exacto con voladizo)", () => {
    const sw = engine.runSweep(track, biBogieVehicle(), opts);
    near(sw.summary!.maxRight, 1.7803, TOL_MM, "exterior");
  });

  it("retranqueo del pivote delantero vs eje = p²/8R = 17.1 mm", () => {
    const sw = engine.runSweep(track, biBogieVehicle(), opts);
    // paso con el cuerpo entero sobre el arco (pivote delantero ~ 40 m)
    const stp = sw.steps!.find((s) => s.s1 > 38 && s.s1 < 42)!;
    expect(stp).toBeTruthy();
    const sFront = stp.chain.sPivots[0];
    const pivFront = stp.chain.pivots[0];
    const onAxis = track.pos(sFront);
    const inset = Math.hypot(pivFront[0] - onAxis[0], pivFront[1] - onAxis[1]);
    near(inset, (1.85 * 1.85) / (8 * 25), 0.0005, "inset p²/8R");
  });

  it("s_f − s_r (arco) > cuerda a = 9.0 (arco más largo que la cuerda)", () => {
    const sw = engine.runSweep(track, biBogieVehicle(), opts);
    const stp = sw.steps!.find((s) => s.s1 > 38 && s.s1 < 42)!;
    const sFront = stp.chain.sPivots[0];
    const sRear = stp.chain.sPivots[1];
    expect(sFront - sRear).toBeGreaterThan(9.0);
    expect(sFront - sRear).toBeLessThan(9.5);
  });
});

describe("§4.4 UIC equivalente del coche de dos bogies (un solo biBogie)", () => {
  it("a / n_a / p / b = 9.0 / 2.5 / 1.85 / 1.275 (dos pivotes)", () => {
    const p = engine.uicParamsFromVehicle(biBogieVehicle());
    near(p.a, 9.0, 0.001, "a");
    near(p.na, 2.5, 0.001, "n_a");
    near(p.p, 1.85, 0.001, "p");
    near(p.b, 1.275, 0.001, "b");
  });
});

describe("§4.4 robustez — radio cerrado R15 (bracket de bisección)", () => {
  it("resuelve en R15 y mantiene s_f − s_r > 9.0", () => {
    const sw = engine.runSweep(arcTrack(15), biBogieVehicle(), { step: 0.1 });
    expect(sw.error).toBeUndefined();
    const stp = sw.steps!.find((s) => s.s1 > 30 && s.s1 < 40)!;
    expect(stp).toBeTruthy();
    expect(stp.chain.sPivots[0] - stp.chain.sPivots[1]).toBeGreaterThan(9.0);
  });
});

describe("§4.4 cadena mixta bogie–suspendido–biBogie", () => {
  function mixedVehicle(): Vehicle {
    return {
      wheelbase: 1.85,
      mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
      modules: [
        {
          id: "C1",
          type: "bogie",
          length: 6,
          width: 2.55,
          pivotFromFront: 2.5,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
        },
        { id: "S2", type: "suspendido", length: 6, width: 2.55 },
        {
          id: "K3",
          type: "biBogie",
          length: 14.0,
          width: 2.55,
          pivotFrontFromFront: 2.5,
          pivotRearFromFront: 11.5,
          wheelbase: 1.85,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabRear: true,
        },
      ],
      joints: [engine.defaultJoint(), engine.defaultJoint()],
    };
  }
  const track = engine.trackFromSegments([
    ["straight", 20],
    ["arc", (25 * Math.PI) / 2, 1 / 25],
    ["straight", 20],
  ]);

  it("la cadena resuelve y el ancho total es finito y > cuerpo", () => {
    const sw = engine.runSweep(track, mixedVehicle(), { step: 0.2 });
    expect(sw.error).toBeUndefined();
    expect(sw.summary!.totalWidth).toBeGreaterThan(2.55);
    expect(Number.isFinite(sw.summary!.totalWidth)).toBe(true);
  });
});

describe("§4.4 simetría de sentido — coche de dos bogies simétrico", () => {
  it("ida sola ≈ bidireccional (±2 mm) para un vehículo simétrico", () => {
    const track = engine.trackFromSegments([
      ["straight", 15],
      ["arc", (25 * Math.PI) / 2, 1 / 25],
      ["straight", 15],
    ]);
    const fwd = engine.runSweep(track, biBogieVehicle(), { step: 0.2 });
    const both = engine.runSweep(track, biBogieVehicle(), { step: 0.2, both: true });
    near(both.summary!.maxLeft, fwd.summary!.maxLeft, TOL_MM, "maxLeft");
    near(both.summary!.maxRight, fwd.summary!.maxRight, TOL_MM, "maxRight");
  });
});

describe("§4.4 bisectriz reduce el ángulo — bogie(libre)–susp–biBogie en bucle R20", () => {
  function chainVehicle(): Vehicle {
    return {
      wheelbase: 1.85,
      mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
      modules: [
        {
          id: "C1",
          type: "bogie",
          length: 6,
          width: 2.55,
          pivotFromFront: 2.5,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
        },
        { id: "S2", type: "suspendido", length: 6, width: 2.55 },
        {
          id: "K3",
          type: "biBogie",
          length: 14.0,
          width: 2.55,
          pivotFrontFromFront: 2.5,
          pivotRearFromFront: 11.5,
          wheelbase: 1.85,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabRear: true,
        },
      ],
      joints: [engine.defaultJoint(), engine.defaultJoint()],
    };
  }
  const track = engine.TRACK_PRESETS.find((p) => p.id === "loop")!.build();

  it("k=30 vs libre: el ángulo máximo de rótula disminuye", () => {
    const vFree = chainVehicle();
    const swFree = engine.runSweep(track, vFree, { step: 0.25 });
    const maxFree = Math.max(...swFree.joints!.map((j) => j.maxAngle));

    const vBi = chainVehicle();
    for (const j of vBi.joints) {
      j.type = "bisectriz";
      j.stiffness = 30;
    }
    const swBi = engine.runSweep(track, vBi, { step: 0.25 });
    const maxBi = Math.max(...swBi.joints!.map((j) => j.maxAngle));

    expect(swBi.error).toBeUndefined();
    expect(maxBi).toBeLessThan(maxFree);
  });
});
