// Perfil de semianchos por PK (canvas inferior): curvas izq/dcha geométricas y
// cinemáticas, referencia de semiancho de caja y comparación UIC 505.
import { $, fmt, resizeCanvas } from "./dom";
import { pkVal } from "./pk";
import { state } from "./state";
import { uicRows } from "./compare";
import { C } from "./theme";
import { hoverS, layerOn } from "./vpshared";

let pf: HTMLCanvasElement;
let pfx: CanvasRenderingContext2D;

export function initProfile(): void {
  pf = $<HTMLCanvasElement>("profile");
  pfx = pf.getContext("2d")!;
}

/** Devuelve el canvas del perfil (para observarlo/redimensionarlo desde main). */
export function profileCanvas(): HTMLCanvasElement {
  return pf;
}

export function drawProfile(): void {
  resizeCanvas(pf);
  const dpr = window.devicePixelRatio || 1;
  pfx.clearRect(0, 0, pf.width, pf.height);
  const sw = state.sweep;
  if (!sw || !sw.rows!.length) return;
  const rows = sw.rows!;
  const W = pf.width,
    H = pf.height,
    mL = 46 * dpr,
    mR = 8 * dpr,
    mT = 8 * dpr,
    mB = 18 * dpr;
  const s0 = rows[0][0],
    s1 = rows[rows.length - 1][0];
  let yMax = 0;
  for (const [, r, l, , rk, lk] of rows)
    yMax = Math.max(yMax, Math.abs(l), Math.abs(r), Math.abs(lk || 0), Math.abs(rk || 0));
  const uicPre = uicRows();
  if (uicPre) for (const [r2, l2] of uicPre) yMax = Math.max(yMax, Math.abs(l2), Math.abs(r2));
  yMax = Math.ceil(yMax * 4) / 4 + 0.25;
  const X = (s: number) => mL + ((W - mL - mR) * (s - s0)) / (s1 - s0);
  const Y = (v: number) => mT + (H - mT - mB) * (1 - (v + yMax) / (2 * yMax));

  // rejilla + cero
  pfx.strokeStyle = C.hairline;
  pfx.lineWidth = 1;
  pfx.font = `${9 * dpr}px 'IBM Plex Mono',monospace`;
  pfx.fillStyle = C.secondary;
  for (let v = -Math.floor(yMax); v <= yMax; v += 1) {
    pfx.beginPath();
    pfx.moveTo(mL, Y(v));
    pfx.lineTo(W - mR, Y(v));
    pfx.stroke();
    pfx.fillText(fmt(v, 1), 6 * dpr, Y(v) + 3 * dpr);
  }
  pfx.strokeStyle = C.axis;
  pfx.beginPath();
  pfx.moveTo(mL, Y(0));
  pfx.lineTo(W - mR, Y(0));
  pfx.stroke();
  for (let s = Math.ceil(s0 / 20) * 20; s <= s1; s += 20)
    pfx.fillText(String(Math.round(pkVal(s))), X(s) - 8 * dpr, H - 5 * dpr);

  // referencia: semiancho de caja
  const hw = sw.summary!.bodyHalfWidth;
  pfx.setLineDash([3 * dpr, 4 * dpr]);
  pfx.strokeStyle = C.secondary;
  for (const v of [hw, -hw]) {
    pfx.beginPath();
    pfx.moveTo(mL, Y(v));
    pfx.lineTo(W - mR, Y(v));
    pfx.stroke();
  }
  pfx.setLineDash([]);

  // envolvente geométrica izq/dcha (huella, continua); cinemática (kin, discontinua)
  const series: Array<[number, string, number[]]> = sw.summary!.kinEnabled
    ? [
        [2, C.footprint, []],
        [1, C.footprint, []],
        [5, C.kin, [4 * dpr, 4 * dpr]],
        [4, C.kin, [4 * dpr, 4 * dpr]],
      ]
    : [
        [2, C.footprint, []],
        [1, C.footprint, []],
      ];
  for (const [idx, color, dash] of series) {
    pfx.beginPath();
    rows.forEach((row, i) => {
      const p = [X(row[0]), Y(row[idx])];
      if (i) pfx.lineTo(p[0], p[1]);
      else pfx.moveTo(p[0], p[1]);
    });
    pfx.setLineDash(dash);
    pfx.strokeStyle = color;
    pfx.lineWidth = 1.4 * dpr;
    pfx.stroke();
    pfx.setLineDash([]);
  }
  // comparacion UIC 505 (verde punteado)
  const uic = layerOn("Uic") ? uicRows() : null;
  if (uic) {
    for (const side of [0, 1] as const) {
      pfx.beginPath();
      uic.forEach((pair, i) => {
        const p = [X(rows[i][0]), Y(pair[side])];
        if (i) pfx.lineTo(p[0], p[1]);
        else pfx.moveTo(p[0], p[1]);
      });
      pfx.setLineDash([2 * dpr, 3 * dpr]);
      pfx.strokeStyle = C.uic;
      pfx.lineWidth = 1.4 * dpr;
      pfx.stroke();
      pfx.setLineDash([]);
    }
    pfx.fillStyle = C.uic;
    pfx.fillText("UIC 505", mL + 6 * dpr, mT + 10 * dpr);
  }
  pfx.fillStyle = C.footprint;
  pfx.fillText("izq", W - 34 * dpr, Y(rows[rows.length - 1][2]) - 4 * dpr);
  pfx.fillText("dcha", W - 38 * dpr, Y(rows[rows.length - 1][1]) + 10 * dpr);

  // posición actual del vehículo
  if (sw.steps!.length) {
    const stp = sw.steps![Math.min(state.playIdx, sw.steps!.length - 1)];
    const sRear = stp.chain.sPivots[stp.chain.sPivots.length - 1];
    pfx.fillStyle = C.vehicleFill;
    pfx.fillRect(
      X(Math.max(s0, sRear)),
      mT,
      Math.max(1, X(Math.min(s1, stp.s1)) - X(Math.max(s0, sRear))),
      H - mT - mB,
    );
    pfx.strokeStyle = C.secondary;
    pfx.lineWidth = 1;
    pfx.beginPath();
    pfx.moveTo(X(stp.s1), mT);
    pfx.lineTo(X(stp.s1), H - mB);
    pfx.stroke();
  }

  // cursor compartido con el viewport (marca vertical en `hoverS`)
  if (hoverS != null && hoverS >= s0 && hoverS <= s1) {
    pfx.strokeStyle = C.vehicle;
    pfx.lineWidth = 1;
    pfx.setLineDash([3 * dpr, 3 * dpr]);
    pfx.beginPath();
    pfx.moveTo(X(hoverS), mT);
    pfx.lineTo(X(hoverS), H - mB);
    pfx.stroke();
    pfx.setLineDash([]);
  }
}
