// CINEMÁTICA — peralte por tabla y sobreanchos cuasi-estáticos por estación.
// Reglas simplificadas (NO EN 15273 certificada): ver docs/ENGINE_NOTES §3.
import type { CantTable, KinRules, SpeedTable, Track } from "../types";

/** Aceleración de la gravedad (m/s²), para la insuficiencia de peralte (E2-7). */
const G = 9.81;

/** Parser CSV "pk;peralte_mm" (acepta ; , o tab). Devuelve [[pk, D_m], ...]. */
export function parseCantCSV(text: string): CantTable | null {
  const table: CantTable = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const m = line.trim().split(/[;,\t]+/);
    if (m.length < 2) continue;
    const pk = parseFloat(m[0]);
    const d = parseFloat(m[1]);
    if (isFinite(pk) && isFinite(d)) table.push([pk, d / 1000]);
  }
  table.sort((a, b) => a[0] - b[0]);
  return table.length >= 2 ? table : null;
}

/** Parser CSV "pk;v_kmh" (acepta ; , o tab). Devuelve [[pk, v_ms], ...] (E2-7). */
export function parseSpeedCSV(text: string): SpeedTable | null {
  const table: SpeedTable = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const m = line.trim().split(/[;,\t]+/);
    if (m.length < 2) continue;
    const pk = parseFloat(m[0]);
    const v = parseFloat(m[1]);
    if (isFinite(pk) && isFinite(v)) table.push([pk, v / 3.6]);
  }
  table.sort((a, b) => a[0] - b[0]);
  return table.length >= 2 ? table : null;
}

export function interpTable(table: CantTable, s: number): number {
  if (s <= table[0][0]) return table[0][1];
  if (s >= table[table.length - 1][0]) return table[table.length - 1][1];
  let lo = 0;
  let hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= s) lo = mid;
    else hi = mid;
  }
  const t = (s - table[lo][0]) / (table[hi][0] - table[lo][0]);
  return table[lo][1] + t * (table[hi][1] - table[lo][1]);
}

/**
 * Sobreanchos cinemáticos por estación y lado. Devuelve un Float64Array de
 * longitud 2·nSt con pares [izq, dcha] por estación k en (2k, 2k+1).
 */
export function kinStationAdd(track: Track, kin: KinRules, stS: Float64Array): Float64Array {
  const nSt = stS.length;
  const kinAdd = new Float64Array(2 * nSt);
  const e = kin.e || 1.5;
  const hh = kin.h || 1.6;
  const both = (kin.q || 0) + (kin.tAlign || 0) + (hh * (kin.tCant || 0)) / e;
  for (let k = 0; k < nSt; k++) {
    const dh = 1.0;
    let dth =
      track.heading(Math.min(track.length, stS[k] + dh)) - track.heading(Math.max(0, stS[k] - dh));
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    const kv = dth / (2 * dh);
    const c = Math.min(1, Math.abs(kv) * (kin.rFull || 30));
    const D =
      kin.cantTable && kin.cantTable.length
        ? Math.abs(interpTable(kin.cantTable, stS[k]))
        : (kin.dMax || 0) * c;
    // Insuficiencia/exceso de peralte. Con perfil de velocidad (E2-7) se usa la
    // insuficiencia REAL I(s) = B·v²·k − D, B = e/g (peralte de equilibrio). Sin
    // él, el escalado heurístico por curvatura (iMax·c, exceso = D si detenido).
    let Ins: number;
    let Eexc: number;
    if (kin.speedTable && kin.speedTable.length) {
      const v = interpTable(kin.speedTable, stS[k]);
      const I = (e / G) * v * v * Math.abs(kv) - D;
      Ins = Math.max(0, I);
      Eexc = Math.max(0, -I);
    } else {
      Eexc = kin.stopped ? D : 0;
      Ins = (kin.iMax || 0) * c;
    }
    const lever = Math.max(0, hh - (kin.hRoll || 0));
    const inside = Math.max(0, (hh * D) / e + (kin.sigma || 0) * (Eexc / e) * lever) + both;
    const outside = Math.max(0, (kin.sigma || 0) * (Ins / e) * lever - (hh * D) / e) + both;
    const isLeftInside = kv > 1e-6;
    const isRightInside = kv < -1e-6;
    kinAdd[2 * k] = isLeftInside ? inside : isRightInside ? outside : both;
    kinAdd[2 * k + 1] = isRightInside ? inside : isLeftInside ? outside : both;
  }
  return kinAdd;
}
