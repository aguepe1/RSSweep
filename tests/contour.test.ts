// ============================================================================
// E2-6 — Contornos de módulo: testeros achaflanados.
//  · El contorno rectángulo explícito reproduce EXACTAMENTE el barrido por defecto.
//  · Un chaflán de cabina reduce el exterior del caso 2 ejes rígido en R25 justo
//    lo que dicta la geometría del vértice (test analítico del vértice).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";

// Módulo 2 ejes rígido idéntico al caso dorado §4.1: L=9, empate a=6, semiancho
// b=1.325, pivote centrado. Exterior dorado en R25 = 1.5296 (radial exacto 1.5293).
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

const track = engine.trackFromSegments([
  ["straight", 8],
  ["arc", (25 * Math.PI) / 2, 1 / 25],
  ["straight", 8],
]);
const opts = { step: 0.1, stationStep: 0.1, edgeStep: 0.1 };

describe("§E2-6 contornos de módulo", () => {
  it("contorno rectángulo explícito ≡ rectángulo por defecto", () => {
    const vDef = rigidModuleVehicle();
    const vRect = rigidModuleVehicle();
    vRect.modules[0]!.contour = engine.rectContour(vRect.modules[0]!);
    const swDef = engine.runSweep(track, vDef, opts);
    const swRect = engine.runSweep(track, vRect, opts);
    expect(Math.abs(swRect.summary!.maxRight - swDef.summary!.maxRight)).toBeLessThan(1e-9);
    expect(Math.abs(swRect.summary!.maxLeft - swDef.summary!.maxLeft)).toBeLessThan(1e-9);
  });

  it("chaflán de cabina reduce el exterior justo lo que dicta el vértice", () => {
    // Geometría analítica del corner exterior (pivote centrado, ambos testeros son
    // cabina en un vehículo de un módulo). Con la cuerda del empate como secante,
    // el punto de pivote está a radio R·cos(θ), θ = (a/2)/R. Un corner a distancia
    // longitudinal Lf del pivote y lateral `lat` cae a radio
    //   sqrt((R·cosθ + lat)² + Lf²)   → offset exterior = radio − R.
    const R = 25;
    const a = 6;
    const b = 1.325; // semiancho
    const Lf = 4.5; // frente del módulo respecto al pivote centrado
    const theta = a / 2 / R;
    const Rc = R * Math.cos(theta);
    const cornerOff = (lat: number, lon: number) => Math.hypot(Rc + lat, lon) - R;

    // Referencia: el rectángulo da el corner sin cortar → dorado 1.5293/1.5296.
    const extRect = cornerOff(b, Lf);
    expect(extRect).toBeCloseTo(1.5293, 3);

    // Chaflán de profundidad d y anchura w en ambas cabinas. El corner (Lf, b) se
    // sustituye por dos vértices: A a (Lf−d, b) y B a (Lf, b−w). El exterior nuevo
    // es el mayor de los dos (por simetría manda igual en frente y cola).
    const d = 1.0;
    const w = 0.5;
    const extA = cornerOff(b, Lf - d); // lateral pleno, retranqueado longitud.
    const extB = cornerOff(b - w, Lf); // frente pleno, lateral recortado.
    const extChamfer = Math.max(extA, extB);
    expect(extChamfer).toBeLessThan(extRect); // el chaflán SÍ reduce el exterior.

    const v = rigidModuleVehicle();
    v.modules[0]!.contour = engine.chamferContour(v.modules[0]!, d, w, true, true);
    const sw = engine.runSweep(track, v, opts);
    // maxRight es el semiancho exterior (offset mínimo → magnitud del exterior).
    expect(sw.summary!.maxRight).toBeGreaterThan(0);
    // coincide con la predicción analítica del vértice dentro de la discretización.
    expect(Math.abs(sw.summary!.maxRight - extChamfer)).toBeLessThan(0.003);
    // y es estrictamente menor que el exterior sin achaflanar (dorado 1.5296).
    expect(sw.summary!.maxRight).toBeLessThan(1.5296);
  });

  it("un chaflán en un módulo articulado nunca aumenta el ancho total", () => {
    // Regresión: el contorno se encaja en [fs, L−rs]; si se dibujara en [0, L] el
    // testero trasero de un módulo con fuelle sobresaldría y aumentaría el barrido.
    const rTrack = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const vRect: Vehicle = structuredClone(
      engine.VEHICLE_PRESETS.find((p) => p.id === "urbos5")!.vehicle,
    );
    const swRect = engine.runSweep(rTrack, vRect, { step: 0.25 });
    const v2: Vehicle = structuredClone(
      engine.VEHICLE_PRESETS.find((p) => p.id === "urbos5")!.vehicle,
    );
    v2.modules[0]!.contour = engine.chamferContour(v2.modules[0]!, 1.0, 0.5, true, false);
    const swCham = engine.runSweep(rTrack, v2, { step: 0.25 });
    expect(swCham.summary!.totalWidth).toBeLessThanOrEqual(swRect.summary!.totalWidth + 1e-6);
  });
});
