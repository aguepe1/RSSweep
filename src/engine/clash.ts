// CLASH CHECK — márgenes entre la envolvente barrida y los obstáculos.
import type { Chain, ClashPoint, ClashResult, Stations, SweepResult, Track, Vec2 } from "../types";
import { vlen, vsub } from "./vec";

function stationNx(st: Stations, k: number): number {
  return st.stNx[k];
}
function stationNy(st: Stations, k: number): number {
  return st.stNy[k];
}

/**
 * Comprueba márgenes: margen>0 holgura, margen<0 invasión. Usa la envolvente
 * cinemática si está activa; si no, la geométrica.
 */
export function clashCheck(
  _track: Track,
  sweep: SweepResult,
  obstacles: Chain[],
  requiredMargin: number | null = 0.05,
  sampleStep = 0.15,
): ClashResult {
  requiredMargin = requiredMargin == null ? 0.05 : requiredMargin;
  const st = sweep.stations!;
  const kinOn = sweep.summary!.kinEnabled;
  const rows = sweep.rows!;
  const pts: Vec2[] = [];
  for (const chain of obstacles) {
    for (let e = 0; e + 1 < chain.length; e++) {
      const a = chain[e];
      const b = chain[e + 1];
      const segLen = vlen(vsub(b, a));
      const nSmp = Math.max(1, Math.ceil(segLen / sampleStep));
      for (let q = 0; q <= nSmp; q++) {
        if (e > 0 && q === 0) continue;
        pts.push([a[0] + ((b[0] - a[0]) * q) / nSmp, a[1] + ((b[1] - a[1]) * q) / nSmp]);
      }
    }
    if (chain.length === 1) pts.push(chain[0]);
  }
  const results: ClashPoint[] = [];
  let minMargin = Infinity;
  let minAt: ClashPoint | null = null;
  for (const p of pts) {
    let best = -1;
    let bd = 1e18;
    for (let r = 0; r < rows.length; r++) {
      const k = rows[r][3];
      const dx = p[0] - st.stX[k];
      const dy = p[1] - st.stY[k];
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = r;
      }
    }
    if (best < 0 || bd > 36) continue;
    const row = rows[best];
    const k = row[3];
    const off = (p[0] - st.stX[k]) * stationNx(st, k) + (p[1] - st.stY[k]) * stationNy(st, k);
    const envL = kinOn ? row[5] : row[2];
    const envR = kinOn ? row[4] : row[1];
    const margin = off >= 0 ? off - envL : envR - off;
    const rec: ClashPoint = {
      x: p[0],
      y: p[1],
      pk: row[0],
      off,
      margin,
      viol: margin < requiredMargin,
    };
    results.push(rec);
    if (margin < minMargin) {
      minMargin = margin;
      minAt = rec;
    }
  }
  const violations = results.filter((r) => r.viol).sort((a, b) => a.margin - b.margin);
  return {
    points: results,
    violations,
    minMargin: isFinite(minMargin) ? minMargin : null,
    minAt,
    requiredMargin,
    envelope: kinOn ? "cinematica" : "geometrica",
  };
}
