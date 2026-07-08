// Esquema del vehículo a escala (E3-1 · 1C): vista en planta sin deformar de la
// composición modular — cajas, testeros achaflanados, pivotes de bogie, rótulas y
// fuelles — con cotas de longitud total y ancho máximo. Es la «pieza de confianza
// nº1»: refleja `state.vehicle` y se redibuja en cada edición del panel de vehículo.
import { rectContour } from "../engine/index";
import type { Vec2 } from "../types";
import { $, fmt } from "./dom";
import { state } from "./state";
import { C } from "./theme";

let host: HTMLElement;

export function initSchematic(): void {
  host = $("schematic");
}

/** Redibuja el esquema a escala en el `<div id="schematic">`. */
export function drawSchematic(): void {
  if (!host) return;
  const v = state.vehicle;
  const mods = v.modules;
  if (!mods.length) {
    host.innerHTML = "";
    return;
  }
  const joints = v.joints ?? [];
  // huecos de testeros (fuelle) entre módulos consecutivos
  const gap = (i: number): number => (i < mods.length - 1 ? (joints[i]?.gap ?? 0) : 0);
  const spanX = mods.reduce((a, m, i) => a + m.length + gap(i), 0);
  const maxW = Math.max(...mods.map((m) => m.width));

  const W = Math.max(160, host.clientWidth || 320);
  const padX = 14,
    padTop = 16,
    padBot = 30;
  const sc = (W - 2 * padX) / spanX;
  const drawH = maxW * sc;
  const H = Math.round(drawH + padTop + padBot);
  const cy = padTop + drawH / 2;
  const X = (xg: number): number => padX + xg * sc;
  const Y = (yl: number): number => cy - yl * sc;

  const parts: string[] = [];
  let x0 = 0;
  mods.forEach((m, i) => {
    const contour: Vec2[] = m.contour && m.contour.length >= 3 ? m.contour : rectContour(m);
    const susp = m.type !== "bogie";
    const pts = contour.map(([xl, yl]) => `${X(x0 + xl).toFixed(1)},${Y(yl).toFixed(1)}`).join(" ");
    parts.push(
      `<polygon class="mod-shape${susp ? " susp" : ""}" points="${pts}" fill="${
        C.vehicleFill
      }" stroke="${susp ? C.fuelle : C.vehicle}" stroke-width="1.2"/>`,
    );
    // etiqueta de módulo (id) centrada
    parts.push(
      `<text x="${X(x0 + m.length / 2).toFixed(1)}" y="${(cy + 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="${C.secondary}">${
        m.id || "M" + (i + 1)
      }</text>`,
    );
    // pivote de bogie
    if (!susp) {
      const px = X(x0 + (m.pivotFromFront ?? m.length / 2));
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${C.vehicle}"/>`);
    }
    // fuelle + rótula hacia el siguiente módulo
    if (i < mods.length - 1) {
      const g = gap(i);
      const rear = X(x0 + m.length);
      const gw = g * sc;
      if (gw > 0.5) {
        parts.push(
          `<rect x="${rear.toFixed(1)}" y="${(cy - drawH / 2).toFixed(1)}" width="${gw.toFixed(
            1,
          )}" height="${drawH.toFixed(1)}" fill="${C.fuelleFill}" stroke="${C.fuelle}" stroke-width="0.8"/>`,
        );
      }
      const jx = rear + gw / 2;
      parts.push(`<circle cx="${jx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.4" fill="${C.ink}"/>`);
    }
    x0 += m.length + gap(i);
  });

  // cota de longitud total (línea inferior con topes y etiqueta)
  const yDim = H - 12;
  parts.push(
    `<line x1="${X(0).toFixed(1)}" y1="${yDim}" x2="${X(spanX).toFixed(1)}" y2="${yDim}" stroke="${C.secondary}" stroke-width="1"/>`,
    `<line x1="${X(0).toFixed(1)}" y1="${yDim - 3}" x2="${X(0).toFixed(1)}" y2="${yDim + 3}" stroke="${C.secondary}"/>`,
    `<line x1="${X(spanX).toFixed(1)}" y1="${yDim - 3}" x2="${X(spanX).toFixed(1)}" y2="${yDim + 3}" stroke="${C.secondary}"/>`,
    `<rect x="${(W / 2 - 32).toFixed(1)}" y="${yDim - 8}" width="64" height="12" fill="#ffffff"/>`,
    `<text x="${(W / 2).toFixed(1)}" y="${yDim + 2}" text-anchor="middle" font-size="9" font-family="'IBM Plex Mono',monospace" fill="${C.ink}">${fmt(spanX, 2)} m</text>`,
  );
  // cota de ancho máximo (vertical, a la izquierda)
  const xW = padX - 4;
  parts.push(
    `<line x1="${xW}" y1="${Y(maxW / 2).toFixed(1)}" x2="${xW}" y2="${Y(-maxW / 2).toFixed(1)}" stroke="${C.secondary}" stroke-width="1"/>`,
    `<text x="${xW + 3}" y="${(cy - 2).toFixed(1)}" font-size="8" font-family="'IBM Plex Mono',monospace" fill="${C.secondary}" transform="rotate(-90 ${xW + 3} ${cy})" text-anchor="middle">${fmt(maxW, 2)}</text>`,
  );

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema del vehículo a escala">${parts.join(
    "",
  )}</svg>`;
}
