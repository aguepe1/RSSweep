// ENVOLVENTE (E2-2) — remapeo del contorno de barrido a estaciones.
//
// La envolvente es la UNIÓN de todas las huellas instantáneas (cuerpo + fuelle +
// espejos). El perfil por PK se obtiene proyectando el contorno a la estación del
// eje más cercana y quedándose, por estación, con el offset lateral máximo (izq +)
// y mínimo (dcha −). Convenio de signo: off = (p−C)·N, con N la normal unitaria.
//
// Aislamiento por VENTANA LONGITUDINAL: cada muestra de borde de un paso s1 sólo se
// remapea a estaciones dentro de la abscisa que ocupa el vehículo en ese paso
// [s1 − Lveh − margen, s1 + margen]. Así una rama del eje separada de otra por más
// que esa ventana en abscisa nunca contamina el perfil de la opuesta, aunque estén
// cerca en el plano (auto-aproximaciones de bucle largo).
//
// LÍMITE CONOCIDO (documentado en ENGINE_NOTES §3): en horquillas de radio inviable
// (< radio mínimo del material) un vehículo articulado largo envuelve físicamente
// ambas ramas a la vez; la región barrida es entonces CONEXA y su ancho grande es el
// barrido real (doble ocupación), no un artefacto de remapeo. Ninguna unión booleana
// lo separa. Ver fixture `hairpin` y test tests/fork.test.ts.
import type { StepFootprint as Step, Stations, Vec2 } from "../types";

/** Índice de la estación más cercana a (px,py) en [kLo,kHi], o −1 si vacío. */
function nearestStation(st: Stations, px: number, py: number, kLo: number, kHi: number): number {
  let best = -1;
  let bd = Infinity;
  for (let k = kLo; k <= kHi; k++) {
    const dx = px - st.stX[k];
    const dy = py - st.stY[k];
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) {
      bd = d2;
      best = k;
    }
  }
  return best;
}

/**
 * Semianchos por estación remapeando el contorno de la unión de huellas.
 * Devuelve `left` (máx offset +N) y `right` (mín offset −N) por estación.
 */
export function remapStations(
  steps: Step[],
  st: Stations,
  nSt: number,
  vehicleLen: number,
  dst: number,
  edgeStep: number,
): { left: Float64Array; right: Float64Array } {
  const left = new Float64Array(nSt).fill(-1e9);
  const right = new Float64Array(nSt).fill(1e9);
  const margin = 6;

  for (const step of steps) {
    // Ventana longitudinal: abscisas que ocupa el vehículo en este paso.
    const wLo = Math.max(0, Math.floor((step.s1 - vehicleLen - margin) / dst));
    const wHi = Math.min(nSt - 1, Math.ceil((step.s1 + margin) / dst));
    for (const poly of step.polys) {
      const pts = poly.pts;
      for (let e = 0; e < pts.length; e++) {
        const p0 = pts[e];
        const p1 = pts[(e + 1) % pts.length];
        const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const nSmp = Math.max(1, Math.ceil(segLen / edgeStep));
        for (let q = 0; q <= nSmp; q++) {
          const px = p0[0] + ((p1[0] - p0[0]) * q) / nSmp;
          const py = p0[1] + ((p1[1] - p0[1]) * q) / nSmp;
          const best = nearestStation(st, px, py, wLo, wHi);
          if (best < 0) continue;
          const off = (px - st.stX[best]) * st.stNx[best] + (py - st.stY[best]) * st.stNy[best];
          if (off > left[best]) left[best] = off;
          if (off < right[best]) right[best] = off;
        }
      }
    }
  }
  return { left, right };
}

/**
 * Contorno de la envolvente como cinta cerrada a partir de los semianchos por
 * estación válidos: lado +N de ida y lado −N de vuelta. Representación poligonal
 * maestra derivada del remapeo (para dibujo/export).
 */
export function envelopeRibbon(
  st: Stations,
  left: Float64Array,
  right: Float64Array,
  nSt: number,
): Vec2[] {
  const leftPts: Vec2[] = [];
  const rightPts: Vec2[] = [];
  for (let k = 0; k < nSt; k++) {
    if (left[k] < -1e8 || right[k] > 1e8) continue;
    leftPts.push([st.stX[k] + left[k] * st.stNx[k], st.stY[k] + left[k] * st.stNy[k]]);
    rightPts.push([st.stX[k] + right[k] * st.stNx[k], st.stY[k] + right[k] * st.stNy[k]]);
  }
  return leftPts.concat(rightPts.reverse());
}
