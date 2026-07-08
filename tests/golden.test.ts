// ============================================================================
// VALORES DORADOS — red de seguridad de regresión (docs/ENGINE_NOTES.md §4)
// Regla de oro: ningún cambio en el motor se mergea sin estos tests en verde.
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle, type Track } from "./_engine";

function near(actual: number, expected: number, tol: number, msg?: string): void {
  expect(
    Math.abs(actual - expected),
    `${msg ?? ""} got ${actual}, want ${expected}±${tol}`,
  ).toBeLessThanOrEqual(tol);
}

function cloneVehicle(id: string): Vehicle {
  const preset = engine.VEHICLE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`vehicle preset ${id} not found`);
  return structuredClone(preset.vehicle);
}
function buildTrack(id: string): Track {
  const preset = engine.TRACK_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`track preset ${id} not found`);
  return preset.build();
}

const TOL_MM = 0.002; // 2 mm
const TOL_DEG = 0.1;
const TOL_CM = 0.01; // 1 cm (matriz de humo)

describe("§4.2 regresión funcional — trazado 1 (R25+clotoides), vehículo 5-mod", () => {
  const track = buildTrack("r25");

  it("longitud del trazado 1 ≈ 99.27 m", () => {
    near(track.length, 99.27, 0.05, "L");
  });

  it("geometría: ancho total / interior / exterior = 3.244 / 1.575 / 1.669", () => {
    const v = cloneVehicle("urbos5");
    const sw = engine.runSweep(track, v, { step: 0.2 });
    expect(sw.error).toBeUndefined();
    const s = sw.summary!;
    near(s.totalWidth, 3.244, TOL_MM, "total");
    near(s.maxLeft, 1.575, TOL_MM, "interior (izq)");
    near(s.maxRight, 1.669, TOL_MM, "exterior (dcha)");
  });

  it("cinemática (defaults): total / izq / dcha = 3.489 / 1.749 / 1.740", () => {
    const v = cloneVehicle("urbos5");
    const kin = engine.defaultKin();
    kin.enabled = true;
    const sw = engine.runSweep(track, v, { step: 0.2, kin });
    const s = sw.summary!;
    near(s.kinTotalWidth, 3.489, TOL_MM, "kin total");
    near(s.kinMaxLeft, 1.749, TOL_MM, "kin izq");
    near(s.kinMaxRight, 1.74, TOL_MM, "kin dcha");
  });

  it("ángulos de rótula (libre): R1..R4 = 19.4 / 15.3 / 15.3 / 19.4°", () => {
    const v = cloneVehicle("urbos5");
    const sw = engine.runSweep(track, v, { step: 0.2 });
    const a = sw.joints!.map((j) => j.maxAngle);
    near(a[0]!, 19.4, TOL_DEG, "R1");
    near(a[1]!, 15.3, TOL_DEG, "R2");
    near(a[2]!, 15.3, TOL_DEG, "R3");
    near(a[3]!, 19.4, TOL_DEG, "R4");
  });

  it("R1 rígida: ángulos R1 / R2 = 0.0° / 30.5°, ancho 4.86 m", () => {
    const v = cloneVehicle("urbos5");
    v.joints[0]!.type = "rigida";
    const sw = engine.runSweep(track, v, { step: 0.2 });
    const a = sw.joints!.map((j) => j.maxAngle);
    near(a[0]!, 0.0, TOL_DEG, "R1");
    near(a[1]!, 30.5, 0.2, "R2");
    near(sw.summary!.totalWidth, 4.86, 0.02, "ancho");
  });

  it("todos los bogies rígidos: exterior 1.669 → 1.653 (Δ≈−p²/8R)", () => {
    const v = cloneVehicle("urbos5");
    for (const m of v.modules) if (m.type === "bogie") m.bogieType = "rigido";
    const sw = engine.runSweep(track, v, { step: 0.2 });
    near(sw.summary!.maxRight, 1.653, TOL_MM, "ext rígido");
  });

  it("UIC equivalente del 5-mod: a / n_a / p / b = 13.9 / 2.3 / 1.85 / 1.325", () => {
    const v = cloneVehicle("urbos5");
    const p = engine.uicParamsFromVehicle(v);
    near(p.a, 13.9, 0.05, "a");
    near(p.na, 2.3, 0.05, "n_a");
    near(p.p, 1.85, 0.001, "p");
    near(p.b, 1.325, 0.001, "b");
  });
});

describe("§4.1 validación analítica exacta — módulo 2 ejes rígido en círculo R25", () => {
  // L=9, empate a=6, semiancho b=1.325, sin espejos.
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
  // Círculo puro R25 con rectas de entrada/salida para el arranque de la cadena.
  const track = engine.trackFromSegments([
    ["straight", 8],
    ["arc", (25 * Math.PI) / 2, 1 / 25],
    ["straight", 8],
  ]);

  it("interior = 1.5048 (b + a²/8R = 1.5050)", () => {
    const sw = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
    });
    near(sw.summary!.maxLeft, 1.5048, 0.001, "interior");
  });
  it("exterior = 1.5296 (radial exacto 1.5293)", () => {
    const sw = engine.runSweep(track, rigidModuleVehicle(), {
      step: 0.1,
      stationStep: 0.1,
      edgeStep: 0.1,
    });
    near(sw.summary!.maxRight, 1.5296, 0.001, "exterior");
  });
});

describe("§4.2 solver de equilibrio (bisectriz) — bucle R20", () => {
  const track = buildTrack("loop");

  it("libre vs bisectriz k=50: ángulo máx 24.4° → 21.2°, ancho 3.33 → 3.60", () => {
    const vFree = cloneVehicle("urbos5");
    const swFree = engine.runSweep(track, vFree, { step: 0.25 });
    const maxFree = Math.max(...swFree.joints!.map((j) => j.maxAngle));
    near(maxFree, 24.4, 0.3, "libre máx");
    near(swFree.summary!.totalWidth, 3.33, 0.02, "libre ancho");

    const vBi = cloneVehicle("urbos5");
    for (const j of vBi.joints) {
      j.type = "bisectriz";
      j.stiffness = 50;
    }
    const swBi = engine.runSweep(track, vBi, { step: 0.25 });
    const maxBi = Math.max(...swBi.joints!.map((j) => j.maxAngle));
    near(maxBi, 21.2, 0.3, "bisectriz máx");
    near(swBi.summary!.totalWidth, 3.6, 0.03, "bisectriz ancho");
    // el equilibrio SÍ reduce el ángulo máximo (moraleja §6: E_final < E_inicial)
    expect(maxBi).toBeLessThan(maxFree);
  });
});

describe("§4.3 matriz de humo (step 0.25, ancho total geo, tol 1 cm)", () => {
  const cases: Array<[string, string, number]> = [
    ["r25", "urbos5", 3.24],
    ["loop", "urbos5", 3.33],
    ["scurve", "urbos5", 3.28],
    ["chicane", "urbos5", 3.23],
    ["r100", "urbos5", 3.17],
    ["r25", "tram7", 3.25],
    ["loop", "tram7", 3.33],
    ["r25", "tram3", 3.51],
    ["loop", "tram3", 3.71],
  ];
  for (const [tid, vid, expected] of cases) {
    it(`${tid} · ${vid} → ${expected} m`, () => {
      const sw = engine.runSweep(buildTrack(tid), cloneVehicle(vid), { step: 0.25 });
      expect(sw.error).toBeUndefined();
      near(sw.summary!.totalWidth, expected, TOL_CM, `${tid}/${vid}`);
    });
  }
});
