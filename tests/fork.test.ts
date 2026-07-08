// ============================================================================
// E2-2 — Aislamiento entre ramas del remapeo de la envolvente a estaciones.
//
// Dos comportamientos:
//  (1) La ventana longitudinal del remapeo aísla una rama del eje separada de otra
//      por más que la longitud del vehículo en ABSCISA, aunque estén cerca en el
//      plano (auto-aproximaciones de bucle largo). Éste es el aporte de E2-2.
//  (2) LÍMITE DOCUMENTADO: en una horquilla de radio inviable (fixture `hairpin`)
//      un vehículo articulado largo envuelve físicamente ambas ramas a la vez; la
//      región barrida es conexa y su ancho grande es doble ocupación real, no una
//      contaminación de remapeo. Ninguna unión booleana de polígonos lo separa.
// ============================================================================
import { describe, it, expect } from "vitest";
import engine from "./_engine";
import type { Poly, Stations, StepFootprint } from "../src/types";

const SENT_LEFT = -1e8;
const SENT_RIGHT = 1e8;

describe("§E2-2 aislamiento por ventana longitudinal (remapStations)", () => {
  // Dos bandas de estaciones PARALELAS a 3 m en el plano pero MUY separadas en
  // abscisa: rama A en y=0 (s=0..30) y rama B en y=3 (s=100..130). Ambas con
  // normal +y. Una huella colocada sobre la rama A a la abscisa ~15 y a y≈1.6
  // (más cerca en el plano de la estación de B que de la de A) NO debe verter
  // ningún offset a la rama B: la ventana longitudinal del paso lo impide.
  const dst = 0.25;
  const nA = 121; // s = 0 .. 30
  const nB = 121; // s = 100 .. 130
  const nSt = nA + nB;
  const st: Stations = {
    stS: new Float64Array(nSt),
    stX: new Float64Array(nSt),
    stY: new Float64Array(nSt),
    stNx: new Float64Array(nSt),
    stNy: new Float64Array(nSt),
  };
  for (let k = 0; k < nA; k++) {
    st.stS[k] = k * dst;
    st.stX[k] = k * dst;
    st.stY[k] = 0;
    st.stNx[k] = 0;
    st.stNy[k] = 1;
  }
  for (let j = 0; j < nB; j++) {
    const k = nA + j;
    st.stS[k] = 100 + j * dst;
    st.stX[k] = j * dst;
    st.stY[k] = 3;
    st.stNx[k] = 0;
    st.stNy[k] = 1;
  }
  // Huella cuadrada centrada en (15, 1.6): puntos a y∈[1.35,1.85] están más cerca
  // en el plano de la banda B (y=3) que de la A (y=0) en su borde superior.
  const poly: Poly = {
    kind: "body",
    pts: [
      [14.5, 1.35],
      [15.5, 1.35],
      [15.5, 1.85],
      [14.5, 1.85],
    ],
  };
  const steps: StepFootprint[] = [{ s1: 15, polys: [poly] }];

  it("la banda B no recibe offsets (aislada por la ventana)", () => {
    const { left, right } = engine.remapStations(steps, st, nSt, 10, dst, 0.1);
    for (let k = nA; k < nSt; k++) {
      expect(left[k]).toBeLessThan(SENT_LEFT); // sentinela intacta
      expect(right[k]).toBeGreaterThan(SENT_RIGHT);
    }
  });

  it("la banda A sí recibe el offset real (~+1.85 en su normal +y)", () => {
    const { left } = engine.remapStations(steps, st, nSt, 10, dst, 0.1);
    let maxA = -Infinity;
    for (let k = 0; k < nA; k++) if (left[k] > SENT_LEFT) maxA = Math.max(maxA, left[k]);
    expect(maxA).toBeGreaterThan(1.8);
    expect(maxA).toBeLessThan(1.9);
  });
});

describe("§E2-2 límite documentado: horquilla de radio inviable = doble ocupación", () => {
  it("el fixture `hairpin` resuelve y su ancho refleja doble ocupación (no ~2.65 m)", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "hairpin")!.build();
    const v = structuredClone(engine.VEHICLE_PRESETS.find((p) => p.id === "urbos5")!.vehicle);
    const sw = engine.runSweep(track, v, { step: 0.25 });
    expect(sw.error).toBeUndefined();
    // Un barrido de una sola rama daría ~2·1.325 + sobreancho ≈ 3.2 m (cf. r100).
    // Aquí el vehículo (32 m) envuelve la horquilla (R1.5): ambas ramas a la vez.
    // El ancho excede claramente al de una rama; es doble ocupación real, y así
    // debe quedar documentado (no es un artefacto que la unión booleana corrija).
    expect(sw.summary!.totalWidth).toBeGreaterThan(2 * sw.summary!.bodyHalfWidth + 1);
  });
});
