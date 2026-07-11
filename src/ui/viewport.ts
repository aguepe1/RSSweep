// Viewport CAD (E3-2): eje de vía, bandas de huella y envolvente cinemática,
// obstáculos, marcadores de clash y vehículo en la posición actual, más reglas
// métricas, rejilla, barra de escala, marcas de PK, readout X/Y/PK/offset bajo el
// cursor, capas conmutables, herramienta de medición y fondo claro/oscuro.
import type { Vec2 } from "../types";
import { $, fmt, resizeCanvas } from "./dom";
import { pkVal } from "./pk";
import { state } from "./state";
import { C, setViewportDark, viewportTheme } from "./theme";
import { hoverS, layerOn, requestRedraw, setHoverS } from "./vpshared";
import { exportViewportPng, exportViewportSvg } from "./viewport-export";

let vp: HTMLCanvasElement;
let vpx: CanvasRenderingContext2D;

/** Herramienta de medición: puntos A y B en coordenadas de mundo (o null). */
const measure: { on: boolean; a: Vec2 | null; b: Vec2 | null } = { on: false, a: null, b: null };

/** Mundo → pantalla (y invertida), en píxeles de buffer (× dpr). */
function W2S(p: Vec2): Vec2 {
  const v = state.view;
  const dpr = window.devicePixelRatio || 1;
  return [(p[0] * v.scale + v.ox) * dpr, (-p[1] * v.scale + v.oy) * dpr];
}

/** Pantalla (px CSS relativos al canvas) → mundo. */
function S2W(cssX: number, cssY: number): Vec2 {
  const v = state.view;
  return [(cssX - v.ox) / v.scale, (v.oy - cssY) / v.scale];
}

/** Proyección de un punto de mundo sobre la polilínea del eje: `{s, off}` (off izq +). */
function projectToTrack(w: Vec2): { s: number; off: number } {
  const t = state.track!;
  let best = Infinity,
    bs = 0,
    bo = 0;
  for (let i = 0; i < t.n - 1; i++) {
    const ax = t.x[i],
      ay = t.y[i],
      dx = t.x[i + 1] - ax,
      dy = t.y[i + 1] - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let u = ((w[0] - ax) * dx + (w[1] - ay) * dy) / len2;
    u = Math.max(0, Math.min(1, u));
    const fx = ax + u * dx,
      fy = ay + u * dy;
    const d = (w[0] - fx) ** 2 + (w[1] - fy) ** 2;
    if (d < best) {
      best = d;
      bs = t.s[i] + u * (t.s[i + 1] - t.s[i]);
      const len = Math.sqrt(len2);
      bo = ((w[0] - fx) * -dy + (w[1] - fy) * dx) / len; // proyección sobre la normal izq
    }
  }
  return { s: bs, off: bo };
}

/** Vértice del eje más cercano en píxeles; ajusta al eje si está a < `pxThr` px. */
function snapToAxis(w: Vec2): Vec2 {
  const t = state.track!;
  const dpr = window.devicePixelRatio || 1;
  const sp = W2S(w);
  let best = Infinity,
    bx = w[0],
    by = w[1];
  for (let i = 0; i < t.n; i++) {
    const q = W2S([t.x[i], t.y[i]]);
    const d = (q[0] - sp[0]) ** 2 + (q[1] - sp[1]) ** 2;
    if (d < best) {
      best = d;
      bx = t.x[i];
      by = t.y[i];
    }
  }
  return Math.sqrt(best) < 12 * dpr ? [bx, by] : w;
}

/** Encuadra vía + envolvente en el viewport. */
export function fitView(): void {
  if (!state.track) return;
  resizeCanvas(vp);
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  const upd = (p: Vec2) => {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  };
  for (let s = 0; s <= state.track.length; s += 1) upd(state.track.pos(s));
  const sw = state.sweep;
  if (sw) {
    const st = sw.stations!;
    for (const [, r, l, k, rk, lk] of sw.rows!) {
      const lo = sw.summary!.kinEnabled ? rk : r;
      const hi = sw.summary!.kinEnabled ? lk : l;
      upd([st.stX[k] + hi * st.stNx[k], st.stY[k] + hi * st.stNy[k]]);
      upd([st.stX[k] + lo * st.stNx[k], st.stY[k] + lo * st.stNy[k]]);
    }
  }
  const dpr = window.devicePixelRatio || 1;
  const w = vp.width / dpr,
    h = vp.height / dpr,
    m = 48;
  const sc = Math.min((w - 2 * m) / Math.max(1e-6, x1 - x0), (h - 2 * m) / Math.max(1e-6, y1 - y0));
  state.view.scale = sc;
  state.view.ox = w / 2 - (sc * (x0 + x1)) / 2;
  state.view.oy = h / 2 + (sc * (y0 + y1)) / 2;
}

/** Paso «bonito» (1/2/5 × 10ⁿ) cuyo tamaño en px se acerca a `targetPx`. */
function niceStep(targetPx: number): number {
  const raw = targetPx / state.view.scale; // metros por targetPx
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const c = raw / p;
  const m = c < 1.5 ? 1 : c < 3.5 ? 2 : c < 7.5 ? 5 : 10;
  return m * p;
}

/** Rejilla métrica sutil (líneas cada `niceStep`). */
function drawGrid(): void {
  const th = viewportTheme();
  const dpr = window.devicePixelRatio || 1;
  const w = vp.width,
    h = vp.height;
  const step = niceStep(64);
  const tl = S2W(0, 0),
    br = S2W(w / dpr, h / dpr);
  vpx.strokeStyle = th.grid;
  vpx.lineWidth = 1;
  vpx.beginPath();
  for (let x = Math.ceil(tl[0] / step) * step; x <= br[0]; x += step) {
    const px = W2S([x, 0])[0];
    vpx.moveTo(px, 0);
    vpx.lineTo(px, h);
  }
  for (let y = Math.ceil(br[1] / step) * step; y <= tl[1]; y += step) {
    const py = W2S([0, y])[1];
    vpx.moveTo(0, py);
    vpx.lineTo(w, py);
  }
  vpx.stroke();
}

/** Reglas métricas (horizontal arriba, vertical izquierda) con marcas y cotas. */
function drawRulers(): void {
  const th = viewportTheme();
  const dpr = window.devicePixelRatio || 1;
  const w = vp.width,
    h = vp.height;
  const rw = 20 * dpr; // grosor de regla
  const step = niceStep(80);
  const tl = S2W(0, 0),
    br = S2W(w / dpr, h / dpr);
  vpx.fillStyle = th.labelBg;
  vpx.fillRect(0, 0, w, rw);
  vpx.fillRect(0, 0, rw, h);
  vpx.strokeStyle = th.axis;
  vpx.lineWidth = 1;
  vpx.beginPath();
  vpx.moveTo(0, rw);
  vpx.lineTo(w, rw);
  vpx.moveTo(rw, 0);
  vpx.lineTo(rw, h);
  vpx.stroke();
  vpx.fillStyle = th.faint;
  vpx.font = `${9 * dpr}px 'IBM Plex Mono',monospace`;
  vpx.strokeStyle = th.axis;
  vpx.beginPath();
  for (let x = Math.ceil(tl[0] / step) * step; x <= br[0]; x += step) {
    const px = W2S([x, 0])[0];
    if (px < rw) continue;
    vpx.moveTo(px, rw - 5 * dpr);
    vpx.lineTo(px, rw);
    vpx.fillText(String(Math.round(x)), px + 2 * dpr, 9 * dpr);
  }
  for (let y = Math.ceil(br[1] / step) * step; y <= tl[1]; y += step) {
    const py = W2S([0, y])[1];
    if (py < rw) continue;
    vpx.moveTo(rw - 5 * dpr, py);
    vpx.lineTo(rw, py);
    vpx.save();
    vpx.translate(9 * dpr, py - 2 * dpr);
    vpx.rotate(-Math.PI / 2);
    vpx.fillText(String(Math.round(y)), 0, 0);
    vpx.restore();
  }
  vpx.stroke();
}

/** Barra de escala dinámica (abajo-izquierda) con longitud «bonita». */
function drawScaleBar(): void {
  const th = viewportTheme();
  const dpr = window.devicePixelRatio || 1;
  const L = niceStep(90); // metros
  const px = L * state.view.scale * dpr;
  const x0 = 30 * dpr,
    y0 = vp.height - 22 * dpr;
  vpx.strokeStyle = th.labelInk;
  vpx.lineWidth = 1.4 * dpr;
  vpx.beginPath();
  vpx.moveTo(x0, y0);
  vpx.lineTo(x0 + px, y0);
  vpx.moveTo(x0, y0 - 4 * dpr);
  vpx.lineTo(x0, y0 + 4 * dpr);
  vpx.moveTo(x0 + px, y0 - 4 * dpr);
  vpx.lineTo(x0 + px, y0 + 4 * dpr);
  vpx.stroke();
  vpx.fillStyle = th.labelInk;
  vpx.font = `${10 * dpr}px 'IBM Plex Mono',monospace`;
  vpx.fillText(`${fmt(L, L < 1 ? 2 : 0)} m`, x0 + px + 6 * dpr, y0 + 3.5 * dpr);
}

/** Marcas de PK cada 10 m sobre el eje, con etiqueta de PK de proyecto. */
function drawPkMarks(): void {
  const th = viewportTheme();
  const dpr = window.devicePixelRatio || 1;
  const t = state.track!;
  vpx.strokeStyle = th.faint;
  vpx.fillStyle = th.faint;
  vpx.lineWidth = 1 * dpr;
  vpx.font = `${9 * dpr}px 'IBM Plex Mono',monospace`;
  for (let s = 0; s <= t.length + 1e-6; s += 10) {
    const p = W2S(t.pos(s));
    const hd = t.heading(s);
    const nx = -Math.sin(hd),
      ny = Math.cos(hd);
    const a: Vec2 = [p[0] - nx * 5 * dpr, p[1] + ny * 5 * dpr];
    const b: Vec2 = [p[0] + nx * 5 * dpr, p[1] - ny * 5 * dpr];
    vpx.beginPath();
    vpx.moveTo(a[0], a[1]);
    vpx.lineTo(b[0], b[1]);
    vpx.stroke();
    vpx.fillText(String(Math.round(pkVal(s))), p[0] + 4 * dpr, p[1] - 4 * dpr);
  }
}

/** Dos carriles a ±gauge/2 del eje (presentación). El eje montado sigue la línea
 *  media dentro del juego de pestaña ya modelado, de modo que los carriles no
 *  alteran la envolvente barrida: son la infraestructura sobre la que apoya. */
function drawRails(): void {
  const t = state.track!;
  const dpr = window.devicePixelRatio || 1;
  const half = state.gauge / 2;
  const N = Math.max(2, Math.ceil(t.length / 0.5));
  vpx.strokeStyle = C.rail;
  vpx.lineWidth = 1.3 * dpr;
  for (const side of [1, -1]) {
    vpx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s = (t.length * i) / N;
      const c = t.pos(s);
      const hd = t.heading(s);
      const nx = -Math.sin(hd),
        ny = Math.cos(hd);
      const p = W2S([c[0] + side * half * nx, c[1] + side * half * ny]);
      if (i) vpx.lineTo(p[0], p[1]);
      else vpx.moveTo(p[0], p[1]);
    }
    vpx.stroke();
  }
}

/** Bastidor de cada bogie + sus dos ejes, reconstruidos de la solución de cadena
 *  (`sPivots`/empate) sin tocar el motor: puro dibujo. Los ejes se dibujan a
 *  ±gauge/2 (ruedas apoyando en el carril); el bastidor, de ancho `bogieWidth`.
 *  El biBogie (E4-B2) aporta dos entradas en `sPivots` ⇒ dos bastidores. */
function drawBogies(stp: { chain: { sPivots: number[] } }): void {
  const t = state.track!;
  const dpr = window.devicePixelRatio || 1;
  const wbDef = state.vehicle.wheelbase || 1.8;
  const halfG = state.gauge / 2;
  vpx.strokeStyle = C.bogie;
  vpx.lineWidth = 1.3 * dpr;
  const frame = (sp: number, mwb: number, bw: number): void => {
    const p1 = t.pos(sp - mwb / 2);
    const p2 = t.pos(sp + mwb / 2);
    const sec = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const nx = -Math.sin(sec),
      ny = Math.cos(sec);
    // bastidor: rectángulo empate × bogieWidth centrado en la cuerda p1→p2
    const corners: Vec2[] = [
      [p1[0] + (nx * bw) / 2, p1[1] + (ny * bw) / 2],
      [p2[0] + (nx * bw) / 2, p2[1] + (ny * bw) / 2],
      [p2[0] - (nx * bw) / 2, p2[1] - (ny * bw) / 2],
      [p1[0] - (nx * bw) / 2, p1[1] - (ny * bw) / 2],
    ];
    vpx.beginPath();
    corners.forEach((c, i) => {
      const p = W2S(c);
      if (i) vpx.lineTo(p[0], p[1]);
      else vpx.moveTo(p[0], p[1]);
    });
    vpx.closePath();
    vpx.stroke();
    // ejes: segmentos transversales a ±gauge/2 en cada rodadura
    for (const pc of [p1, p2]) {
      const a = W2S([pc[0] + nx * halfG, pc[1] + ny * halfG]);
      const b = W2S([pc[0] - nx * halfG, pc[1] - ny * halfG]);
      vpx.beginPath();
      vpx.moveTo(a[0], a[1]);
      vpx.lineTo(b[0], b[1]);
      vpx.stroke();
    }
  };
  // cursor sobre sPivots: bogie=1 entrada, biBogie=2 entradas.
  let pi = 0;
  for (const m of state.vehicle.modules) {
    const mwb = m.wheelbase || wbDef;
    const bw = m.bogieWidth ?? state.gauge + 0.2;
    if (m.type === "bogie") {
      const sp = stp.chain.sPivots[pi++];
      if (sp != null) frame(sp, mwb, bw);
    } else if (m.type === "biBogie") {
      const sf = stp.chain.sPivots[pi++];
      const sr = stp.chain.sPivots[pi++];
      if (sf != null) frame(sf, mwb, bw);
      if (sr != null) frame(sr, mwb, bw);
    }
  }
}

/** Marcador de cursor compartido (línea perpendicular al eje en `hoverS`). */
function drawHover(): void {
  if (hoverS == null || !state.track) return;
  const dpr = window.devicePixelRatio || 1;
  const p = W2S(state.track.pos(hoverS));
  vpx.strokeStyle = C.vehicle;
  vpx.lineWidth = 1 * dpr;
  vpx.beginPath();
  vpx.arc(p[0], p[1], 4 * dpr, 0, 7);
  vpx.stroke();
}

/** Dibuja la regla de medición y su cota (distancia + Δoffset). */
function drawMeasure(): void {
  if (!measure.a) return;
  const th = viewportTheme();
  const dpr = window.devicePixelRatio || 1;
  const pa = W2S(measure.a);
  const dot = (p: Vec2) => {
    vpx.beginPath();
    vpx.arc(p[0], p[1], 3 * dpr, 0, 7);
    vpx.fill();
  };
  vpx.fillStyle = C.uic;
  dot(pa);
  if (!measure.b) return;
  const pb = W2S(measure.b);
  vpx.strokeStyle = C.uic;
  vpx.lineWidth = 1.4 * dpr;
  vpx.setLineDash([5 * dpr, 3 * dpr]);
  vpx.beginPath();
  vpx.moveTo(pa[0], pa[1]);
  vpx.lineTo(pb[0], pb[1]);
  vpx.stroke();
  vpx.setLineDash([]);
  dot(pb);
  const dist = Math.hypot(measure.b[0] - measure.a[0], measure.b[1] - measure.a[1]);
  const dOff = projectToTrack(measure.b).off - projectToTrack(measure.a).off;
  const label = `${fmt(dist, 2)} m  Δoff ${fmt(dOff, 2)} m`;
  const mx = (pa[0] + pb[0]) / 2,
    my = (pa[1] + pb[1]) / 2;
  vpx.font = `${11 * dpr}px 'IBM Plex Mono',monospace`;
  const tw = vpx.measureText(label).width;
  vpx.fillStyle = th.labelBg;
  vpx.fillRect(mx + 6 * dpr, my - 16 * dpr, tw + 8 * dpr, 15 * dpr);
  vpx.fillStyle = C.uic;
  vpx.fillText(label, mx + 10 * dpr, my - 5 * dpr);
  const out = document.getElementById("vpMeasure");
  if (out) out.textContent = `d = ${fmt(dist, 2)} m · Δoff = ${fmt(dOff, 2)} m`;
}

export function drawViewport(): void {
  resizeCanvas(vp);
  const dpr = window.devicePixelRatio || 1;
  const th = viewportTheme();
  vpx.clearRect(0, 0, vp.width, vp.height);
  vpx.fillStyle = th.bg;
  vpx.fillRect(0, 0, vp.width, vp.height);
  if (!state.track) return;
  const sw = state.sweep;
  if ((document.getElementById("vpGrid") as HTMLInputElement | null)?.checked ?? true) drawGrid();

  // banda de envolvente cinemática (si está activa) — debajo de la geométrica
  if (sw && sw.summary!.kinEnabled && layerOn("Kin")) {
    const st = sw.stations!;
    vpx.beginPath();
    sw.rows!.forEach(([, , , k, , lk], i) => {
      const p = W2S([st.stX[k] + lk * st.stNx[k], st.stY[k] + lk * st.stNy[k]]);
      if (i) vpx.lineTo(p[0], p[1]);
      else vpx.moveTo(p[0], p[1]);
    });
    for (let i = sw.rows!.length - 1; i >= 0; i--) {
      const [, , , k, rk] = sw.rows![i];
      const p = W2S([st.stX[k] + rk * st.stNx[k], st.stY[k] + rk * st.stNy[k]]);
      vpx.lineTo(p[0], p[1]);
    }
    vpx.closePath();
    vpx.fillStyle = C.kinFill;
    vpx.fill();
    vpx.setLineDash([5 * dpr, 4 * dpr]);
    vpx.strokeStyle = C.kin;
    vpx.lineWidth = 1.1 * dpr;
    vpx.stroke();
    vpx.setLineDash([]);
  }

  // banda de huella
  if (sw && layerOn("Footprint")) {
    vpx.beginPath();
    const st = sw.stations!;
    sw.rows!.forEach(([, , l, k], i) => {
      const p = W2S([st.stX[k] + l * st.stNx[k], st.stY[k] + l * st.stNy[k]]);
      if (i) vpx.lineTo(p[0], p[1]);
      else vpx.moveTo(p[0], p[1]);
    });
    for (let i = sw.rows!.length - 1; i >= 0; i--) {
      const [, r, , k] = sw.rows![i];
      const p = W2S([st.stX[k] + r * st.stNx[k], st.stY[k] + r * st.stNy[k]]);
      vpx.lineTo(p[0], p[1]);
    }
    vpx.closePath();
    vpx.fillStyle = C.footprintFill;
    vpx.fill();
    vpx.strokeStyle = C.footprint;
    vpx.lineWidth = 1.2 * dpr;
    vpx.stroke();
  }

  // eje de vía
  vpx.beginPath();
  const N = Math.max(2, Math.ceil(state.track.length / 0.5));
  for (let i = 0; i <= N; i++) {
    const p = W2S(state.track.pos((state.track.length * i) / N));
    if (i) vpx.lineTo(p[0], p[1]);
    else vpx.moveTo(p[0], p[1]);
  }
  vpx.setLineDash([6 * dpr, 5 * dpr]);
  vpx.strokeStyle = th.faint;
  vpx.lineWidth = 1.1 * dpr;
  vpx.stroke();
  vpx.setLineDash([]);
  if (layerOn("Rail")) drawRails();
  drawPkMarks();
  // marca de inicio
  const p0 = W2S(state.track.pos(0));
  vpx.fillStyle = C.ok;
  vpx.beginPath();
  vpx.arc(p0[0], p0[1], 4 * dpr, 0, 7);
  vpx.fill();

  // obstáculos y clash
  if (state.obstacles && layerOn("Obs")) {
    vpx.strokeStyle = C.obstacle;
    vpx.lineWidth = 1.6 * dpr;
    for (const chain of state.obstacles) {
      if (chain.length === 1) {
        const p = W2S(chain[0]);
        vpx.beginPath();
        vpx.arc(p[0], p[1], 3 * dpr, 0, 7);
        vpx.stroke();
        continue;
      }
      vpx.beginPath();
      chain.forEach((pt, i) => {
        const p = W2S(pt);
        if (i) vpx.lineTo(p[0], p[1]);
        else vpx.moveTo(p[0], p[1]);
      });
      vpx.stroke();
    }
    if (state.clash) {
      vpx.fillStyle = C.invasion;
      for (const v of state.clash.violations) {
        const p = W2S([v.x, v.y]);
        vpx.beginPath();
        vpx.arc(p[0], p[1], 4 * dpr, 0, 7);
        vpx.fill();
      }
      if (state.clash.minAt) {
        const p = W2S([state.clash.minAt.x, state.clash.minAt.y]);
        vpx.strokeStyle = state.clash.minMargin! < state.clash.requiredMargin ? C.invasion : C.ok;
        vpx.lineWidth = 1.4 * dpr;
        vpx.beginPath();
        vpx.arc(p[0], p[1], 9 * dpr, 0, 7);
        vpx.stroke();
        vpx.font = `${10 * dpr}px 'IBM Plex Mono',monospace`;
        vpx.fillStyle = vpx.strokeStyle;
        vpx.fillText(
          (state.clash.minMargin! * 1000).toFixed(0) + " mm",
          p[0] + 12 * dpr,
          p[1] - 8 * dpr,
        );
      }
    }
  }

  // vehículo en la posición actual
  if (sw && sw.steps!.length && layerOn("Veh")) {
    const stp = sw.steps![Math.min(state.playIdx, sw.steps!.length - 1)];
    const styles: Record<string, [string, string]> = {
      fuelle: [C.fuelleFill, C.fuelle],
      body: [C.vehicleFill, C.vehicle],
      mirror: [C.vehicleFillStrong, C.vehicle],
    };
    for (const kind of ["fuelle", "body", "mirror"] as const) {
      for (const poly of stp.polys) {
        if (poly.kind !== kind) continue;
        vpx.beginPath();
        poly.pts.forEach((pt, i) => {
          const p = W2S(pt);
          if (i) vpx.lineTo(p[0], p[1]);
          else vpx.moveTo(p[0], p[1]);
        });
        vpx.closePath();
        vpx.fillStyle = styles[kind][0];
        vpx.fill();
        vpx.strokeStyle = styles[kind][1];
        vpx.lineWidth = 1.1 * dpr;
        vpx.stroke();
      }
    }
    // bastidor de bogie + ejes (debajo de los pivotes)
    if (layerOn("Rail")) drawBogies(stp);
    // pivotes (posición real en el plano; el bogie rígido y el biBogie NO van sobre
    // el eje: retranqueo p²/8R hacia el interior — E4-B2)
    vpx.fillStyle = C.vehicle;
    for (const pt of stp.chain.pivots) {
      const p = W2S(pt);
      vpx.beginPath();
      vpx.arc(p[0], p[1], 2.6 * dpr, 0, 7);
      vpx.fill();
    }
    // rótulas: punto + ángulo de giro instantáneo
    vpx.font = `${10 * dpr}px 'IBM Plex Mono',monospace`;
    stp.chain.jointPts.forEach((jp, k) => {
      const ang = stp.chain.jointAngles[k];
      const lim = state.vehicle.joints[k]?.maxAngleDeg || 0;
      const over = lim > 0 && Math.abs(ang) > lim;
      const p = W2S(jp);
      vpx.fillStyle = over ? C.invasion : th.labelInk;
      vpx.beginPath();
      vpx.arc(p[0], p[1], 2.2 * dpr, 0, 7);
      vpx.fill();
      const label = (ang >= 0 ? "+" : "") + ang.toFixed(1) + "°";
      const tw = vpx.measureText(label).width;
      vpx.fillStyle = th.labelBg;
      vpx.fillRect(p[0] + 6 * dpr, p[1] - 14 * dpr, tw + 8 * dpr, 13 * dpr);
      vpx.fillStyle = over ? C.invasion : th.labelInk;
      vpx.fillText(label, p[0] + 10 * dpr, p[1] - 4 * dpr);
    });
    $("pkLabel").textContent = "PK " + fmt(stp.s1, 2) + " m";
  } else if (!sw) $("pkLabel").textContent = "PK —";

  drawHover();
  drawMeasure();
  drawScaleBar();
  drawRulers();
}

/** Actualiza el readout de coordenadas bajo el cursor y el hover compartido. */
function updateReadout(cssX: number, cssY: number): void {
  if (!state.track) return;
  const w = S2W(cssX, cssY);
  const pr = projectToTrack(w);
  setHoverS(pr.s);
  const out = document.getElementById("vpReadout");
  if (out)
    out.textContent = `X ${fmt(w[0], 2)}  Y ${fmt(w[1], 2)}  ·  PK ${fmt(pkVal(pr.s), 1)}  off ${fmt(pr.off, 2)} m`;
}

/** Activa/desactiva la herramienta de medición y resetea sus puntos. */
function setMeasure(on: boolean): void {
  measure.on = on;
  measure.a = null;
  measure.b = null;
  $("btnMeasure").classList.toggle("on", on);
  vp.style.cursor = on ? "crosshair" : "grab";
  const out = document.getElementById("vpMeasure");
  if (out && !on) out.textContent = "";
  drawViewport();
}

/** Cablea el canvas del viewport (pan, zoom, encuadre). `onResize` redibuja todo. */
export function initViewport(onDraw: () => void): void {
  vp = $<HTMLCanvasElement>("viewport");
  vpx = vp.getContext("2d")!;

  let dragging: [number, number] | null = null;
  vp.addEventListener("mousedown", (e) => {
    if (measure.on) return;
    dragging = [e.clientX, e.clientY];
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    state.view.ox += e.clientX - dragging[0];
    state.view.oy += e.clientY - dragging[1];
    dragging = [e.clientX, e.clientY];
    drawViewport();
  });
  window.addEventListener("mouseup", () => (dragging = null));
  vp.addEventListener("mousemove", (e) => {
    const r = vp.getBoundingClientRect();
    updateReadout(e.clientX - r.left, e.clientY - r.top);
    if (!dragging) requestRedraw();
  });
  vp.addEventListener("mouseleave", () => {
    setHoverS(null);
    const out = document.getElementById("vpReadout");
    if (out) out.textContent = "";
    requestRedraw();
  });
  vp.addEventListener("click", (e) => {
    if (!measure.on || !state.track) return;
    const r = vp.getBoundingClientRect();
    const w = snapToAxis(S2W(e.clientX - r.left, e.clientY - r.top));
    if (!measure.a || measure.b) {
      measure.a = w;
      measure.b = null;
    } else {
      measure.b = w;
    }
    drawViewport();
  });
  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect(),
        mx = e.clientX - r.left,
        my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15,
        v = state.view;
      v.ox = mx - f * (mx - v.ox);
      v.oy = my - f * (my - v.oy);
      v.scale *= f;
      drawViewport();
    },
    { passive: false },
  );
  $("btnFit").addEventListener("click", () => {
    fitView();
    onDraw();
  });
  $("btnMeasure").addEventListener("click", () => setMeasure(!measure.on));
  window.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "m" || e.key === "M") setMeasure(!measure.on);
  });
  for (const id of ["vpGrid", "layFootprint", "layKin", "layObs", "layVeh", "layUic", "layRail"])
    document.getElementById(id)?.addEventListener("change", () => requestRedraw());
  document.getElementById("trackGauge")?.addEventListener("input", (e) => {
    const mm = parseFloat((e.target as HTMLInputElement).value);
    if (mm > 0) state.gauge = mm / 1000;
    requestRedraw();
  });
  document.getElementById("vpDark")?.addEventListener("change", (e) => {
    setViewportDark((e.target as HTMLInputElement).checked);
    requestRedraw();
  });
  document.getElementById("btnPngOut")?.addEventListener("click", () => exportViewportPng(vp));
  document.getElementById("btnSvgOut")?.addEventListener("click", () => exportViewportSvg(vp));
}
