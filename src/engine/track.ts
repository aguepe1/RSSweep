// TRACK — curva paramétrica del eje por longitud de arco.
import type { Track, TrackSegment, Vec2 } from "../types";

/** Construcción desde segmentos de curvatura (presets). */
export function trackFromSegments(segments: TrackSegment[], ds = 0.02): Track {
  const pieces: Array<[number, number, number, number]> = [];
  let s0 = 0;
  for (const seg of segments) {
    const typ = seg[0];
    const L = seg[1];
    if (typ === "straight") pieces.push([s0, s0 + L, 0, 0]);
    else if (typ === "arc") pieces.push([s0, s0 + L, seg[2], seg[2]]);
    else pieces.push([s0, s0 + L, seg[2], seg[3]]);
    s0 += L;
  }
  const n = Math.floor(s0 / ds) + 1;
  const s = new Float64Array(n);
  const k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s[i] = Math.min(i * ds, s0);
    for (const [sa, sb, ka, kb] of pieces) {
      if (s[i] >= sa && s[i] <= sb) {
        k[i] = sb > sa ? ka + ((kb - ka) * (s[i] - sa)) / (sb - sa) : ka;
        break;
      }
    }
  }
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const th = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dsi = s[i] - s[i - 1];
    th[i] = th[i - 1] + 0.5 * (k[i] + k[i - 1]) * dsi;
    x[i] = x[i - 1] + 0.5 * (Math.cos(th[i]) + Math.cos(th[i - 1])) * dsi;
    y[i] = y[i - 1] + 0.5 * (Math.sin(th[i]) + Math.sin(th[i - 1])) * dsi;
  }
  return makeTrack(s, x, y);
}

/** Construcción desde lista de puntos (import DXF). */
export function trackFromPoints(pts: Vec2[]): Track {
  const xs = [pts[0][0]];
  const ys = [pts[0][1]];
  const ss = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d < 1e-9) continue;
    ss.push(ss[ss.length - 1] + d);
    xs.push(pts[i][0]);
    ys.push(pts[i][1]);
  }
  return makeTrack(Float64Array.from(ss), Float64Array.from(xs), Float64Array.from(ys));
}

/** Eje recorrido en sentido inverso (mismos puntos, orden invertido) — E2-5. */
export function reverseTrack(track: Track): Track {
  const n = track.n;
  const pts: Vec2[] = new Array(n);
  for (let i = 0; i < n; i++) pts[i] = [track.x[n - 1 - i], track.y[n - 1 - i]];
  return trackFromPoints(pts);
}

export function makeTrack(
  s: Float64Array,
  x: Float64Array,
  y: Float64Array,
  extend = false,
): Track {
  const n = s.length;
  const length = s[n - 1];
  function locate(sv: number): number {
    if (sv <= 0) return 0;
    if (sv >= length) return n - 2;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= sv) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  function pos(sv: number): Vec2 {
    // Por defecto el eje se recorta a [0, longitud]. Con `extend` la posición se
    // prolonga en línea recta (tangente del segmento extremo) fuera del rango: el
    // índice queda fijado en el primer/último tramo y el parámetro t sale de [0,1],
    // de modo que la interpolación lineal extrapola con el rumbo del extremo.
    if (!extend) sv = Math.max(0, Math.min(length, sv));
    const i = locate(sv);
    const t = (sv - s[i]) / (s[i + 1] - s[i]);
    return [x[i] + t * (x[i + 1] - x[i]), y[i] + t * (y[i + 1] - y[i])];
  }
  function heading(sv: number): number {
    const h = 0.25;
    const p1 = pos(sv - h);
    const p2 = pos(sv + h);
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }
  function secantHeading(sv: number, base: number): number {
    const p1 = pos(sv - base / 2);
    const p2 = pos(sv + base / 2);
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }
  return { s, x, y, n, length, pos, heading, secantHeading };
}
