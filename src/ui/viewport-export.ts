// Export del encuadre del viewport (E3-2): PNG a resolución de impresión (canvas
// reescalado ×factor) y SVG vectorial reconstruido de la escena (eje, huella,
// envolvente cinemática, obstáculos y vehículo) usando la misma proyección
// mundo→pantalla que el viewport, para un plano imprimible sin dependencias.
import type { Vec2 } from "../types";
import { download } from "./dom";
import { state } from "./state";
import { C, viewportTheme } from "./theme";
import { layerOn } from "./vpshared";
import { VERSION } from "../version";

/** Mundo → pantalla en px CSS (sin dpr): coincide con `state.view`. */
function w2s(p: Vec2): Vec2 {
  const v = state.view;
  return [p[0] * v.scale + v.ox, -p[1] * v.scale + v.oy];
}

/** PNG del canvas actual reescalado ×`factor` (por defecto 3 ≈ 300 dpi). */
export function exportViewportPng(canvas: HTMLCanvasElement, factor = 3): void {
  const off = document.createElement("canvas");
  off.width = canvas.width * factor;
  off.height = canvas.height * factor;
  const ctx = off.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, off.width, off.height);
  off.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "barrido_viewport.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/** Construye la cadena de puntos de una banda cerrada (lado ext + lado int). */
function bandPath(hiIdx: number, loIdx: number): string {
  const sw = state.sweep!;
  const st = sw.stations!;
  const pts: Vec2[] = [];
  sw.rows!.forEach((row) => {
    const k = row[3];
    const hi = row[hiIdx];
    pts.push(w2s([st.stX[k] + hi * st.stNx[k], st.stY[k] + hi * st.stNy[k]]));
  });
  for (let i = sw.rows!.length - 1; i >= 0; i--) {
    const row = sw.rows![i];
    const k = row[3];
    const lo = row[loIdx];
    pts.push(w2s([st.stX[k] + lo * st.stNx[k], st.stY[k] + lo * st.stNy[k]]));
  }
  return (
    pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + " Z"
  );
}

/** SVG vectorial del encuadre actual (mismas capas activas que el viewport). */
export function exportViewportSvg(canvas: HTMLCanvasElement): void {
  if (!state.track) return;
  const th = viewportTheme();
  const r = canvas.getBoundingClientRect();
  const W = Math.round(r.width),
    H = Math.round(r.height);
  const sw = state.sweep;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );
  parts.push(`<!-- BARRIDO v${VERSION} · export SVG del viewport -->`);
  parts.push(`<rect width="${W}" height="${H}" fill="${th.bg}"/>`);

  // banda cinemática (debajo) y de huella
  if (sw && sw.summary!.kinEnabled && layerOn("Kin"))
    parts.push(
      `<path d="${bandPath(5, 4)}" fill="${C.kinFill}" stroke="${C.kin}" stroke-width="1.1" stroke-dasharray="5 4"/>`,
    );
  if (sw && layerOn("Footprint"))
    parts.push(
      `<path d="${bandPath(2, 1)}" fill="${C.footprintFill}" stroke="${C.footprint}" stroke-width="1.2"/>`,
    );

  // eje de vía (discontinuo)
  const N = Math.max(2, Math.ceil(state.track.length / 0.5));
  const axis: string[] = [];
  for (let i = 0; i <= N; i++) {
    const p = w2s(state.track.pos((state.track.length * i) / N));
    axis.push(`${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
  }
  parts.push(
    `<path d="${axis.join(" ")}" fill="none" stroke="${th.faint}" stroke-width="1.1" stroke-dasharray="6 5"/>`,
  );

  // obstáculos
  if (state.obstacles && layerOn("Obs"))
    for (const chain of state.obstacles) {
      if (chain.length === 1) {
        const p = w2s(chain[0]);
        parts.push(
          `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="3" fill="none" stroke="${C.obstacle}" stroke-width="1.6"/>`,
        );
        continue;
      }
      const d = chain
        .map((pt, i) => {
          const p = w2s(pt);
          return `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
        })
        .join(" ");
      parts.push(`<path d="${d}" fill="none" stroke="${C.obstacle}" stroke-width="1.6"/>`);
    }

  // vehículo en la posición actual
  if (sw && sw.steps!.length && layerOn("Veh")) {
    const stp = sw.steps![Math.min(state.playIdx, sw.steps!.length - 1)];
    const styles: Record<string, [string, string]> = {
      fuelle: [C.fuelleFill, C.fuelle],
      body: [C.vehicleFill, C.vehicle],
      mirror: [C.vehicleFillStrong, C.vehicle],
    };
    for (const kind of ["fuelle", "body", "mirror"] as const)
      for (const poly of stp.polys) {
        if (poly.kind !== kind) continue;
        const d =
          poly.pts
            .map((pt, i) => {
              const p = w2s(pt);
              return `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
            })
            .join(" ") + " Z";
        parts.push(
          `<path d="${d}" fill="${styles[kind][0]}" stroke="${styles[kind][1]}" stroke-width="1.1"/>`,
        );
      }
  }
  parts.push("</svg>");
  download("barrido_viewport.svg", parts.join("\n"), "image/svg+xml");
}
