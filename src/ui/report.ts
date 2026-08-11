// INFORME DE GÁLIBO (E4-1) — «la joya»: documento HTML paginado, imprimible a PDF
// desde el navegador (Ctrl+P / botón), con `@media print` + `@page`, cabecera/pie y
// hash de parámetros para reproducibilidad. Es SOLO presentación sobre `state`
// (sweep + clash + uic + vehículo + trazado + reglas): no toca el motor ni los
// dorados. Legible en B/N: cada serie lleva además de color un patrón de trazo
// distinto (huella continua, cinemática discontinua, UIC punteada) — el color no es
// el único canal (BACKLOG E4-1). El texto de hipótesis es fijo (ENGINE_NOTES §1/§5).
import { rectContour, uic505Profile, vehicleLength } from "../engine/index";
import type { Vec2 } from "../types";
import { $, fmt } from "./dom";
import { state } from "./state";
import { C } from "./theme";
import { APP_NAME, VERSION } from "../version";
import { t, numLocale } from "./i18n";
import { pkFmt } from "./pk";
import { paramHash } from "./param-hash";

let viewEl: HTMLElement;
let bodyEl: HTMLElement;
let opened = false;

export function isReportOpen(): boolean {
  return opened;
}

export function initReport(): void {
  viewEl = $("reportView");
  bodyEl = $("reportBody");
  $("menuReport").addEventListener("click", openReport);
  $("btnReportClose").addEventListener("click", closeReport);
  $("btnReportPrint").addEventListener("click", () => window.print());
  document.addEventListener(
    "keydown",
    (e) => {
      if (opened && e.key === "Escape") {
        e.stopPropagation();
        closeReport();
      }
    },
    true,
  );
}

export function openReport(): void {
  bodyEl.innerHTML = buildReport();
  viewEl.hidden = false;
  opened = true;
  $<HTMLButtonElement>("btnReportPrint").focus();
}

function closeReport(): void {
  opened = false;
  viewEl.hidden = true;
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Radio mínimo del trazado (m) por muestreo de curvatura; null si es recto. */
function minRadius(): number | null {
  const tr = state.track;
  if (!tr) return null;
  const h = 0.5;
  let kmax = 0;
  for (let s = h; s <= tr.length - h; s += 0.5) {
    let dth = tr.heading(s + h) - tr.heading(s - h);
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    const k = Math.abs(dth) / (2 * h);
    if (k > kmax) kmax = k;
  }
  return kmax > 1e-6 ? 1 / kmax : null;
}

// ---------------------------------------------------------------- documento
function buildReport(): string {
  const sw = state.sweep;
  if (!sw || sw.error || !sw.summary) {
    return `<section class="rp-page"><div class="rp-empty">${t("rp.needCalc")}</div></section>`;
  }
  return (
    runningChrome() +
    coverPage() +
    inputsPage() +
    hypothesesPage() +
    resultsPage() +
    (state.clash ? clashPage() : "") +
    (state.uic.enabled ? uicPage() : "")
  );
}

/** Pie/cabecera repetidos (identidad del documento en cada página impresa). */
function runningChrome(): string {
  const hash = paramHash();
  const date = new Date().toLocaleDateString(numLocale());
  return (
    `<div class="rp-runhead" aria-hidden="true"><span>${APP_NAME} · ${t("rp.title")}</span>` +
    `<span>${esc(state.trackName || "—")}</span></div>` +
    `<div class="rp-runfoot" aria-hidden="true"><span>${APP_NAME} v${VERSION} · hash ${hash}</span>` +
    `<span>${date}</span></div>`
  );
}

function coverPage(): string {
  const s = state.sweep!.summary!;
  const hash = paramHash();
  const date = new Date().toLocaleString(numLocale());
  const rows: Array<[string, string]> = [
    [t("rp.project"), esc(state.trackName || "—")],
    [
      t("rp.vehicle"),
      `${state.vehicle.modules.length} ${t("cart.modules")} · ${fmt(vehicleLength(state.vehicle), 2)} m`,
    ],
    [t("rp.date"), date],
    [t("rp.version"), `${APP_NAME} v${VERSION}`],
    [t("rp.hash"), `<span class="rp-mono">${hash}</span>`],
  ];
  const kpis: Array<[string, string, boolean]> = [
    [t("cart.totalWidth"), `${fmt(s.totalWidth)} m`, false],
  ];
  if (s.kinEnabled) kpis.push([t("cart.kinTotal"), `${fmt(s.kinTotalWidth)} m`, false]);
  const clash = state.clash;
  if (clash && clash.minMargin != null) {
    const ok = clash.minMargin >= clash.requiredMargin;
    kpis.push([t("rp.minMargin"), `${fmt(clash.minMargin * 1000, 0)} mm`, !ok]);
  }
  return (
    `<section class="rp-page rp-cover">` +
    `<div class="rp-cartouche">` +
    `<div class="rp-cart-title"><b>${t("rp.title")}</b><span>${APP_NAME} v${VERSION}</span></div>` +
    `<table class="rp-kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>` +
    `<div class="rp-kpis">${kpis
      .map(
        ([k, v, bad]) =>
          `<div class="rp-kpi${bad ? " bad" : ""}"><span class="rp-kpi-v">${v}</span><span class="rp-kpi-k">${k}</span></div>`,
      )
      .join("")}</div>` +
    `<p class="rp-disclaimer">${t("rp.disclaimer")}</p>` +
    `</div></section>`
  );
}

function inputsPage(): string {
  const v = state.vehicle;
  const modRows = v.modules
    .map((m, i) => {
      const piv =
        m.type === "biBogie"
          ? `${fmt(m.pivotFrontFromFront ?? 0, 2)} / ${fmt(m.pivotRearFromFront ?? 0, 2)}`
          : m.type === "bogie"
            ? fmt(m.pivotFromFront ?? 0, 2)
            : "—";
      return `<tr><td>${esc(m.id || "M" + (i + 1))}</td><td>${t("rp.type." + m.type) || m.type}</td><td>${fmt(m.length, 2)}</td><td>${fmt(m.width, 2)}</td><td>${piv}</td></tr>`;
    })
    .join("");
  const jointRows = (v.joints || [])
    .map(
      (j, i) =>
        `<tr><td>R${i + 1}</td><td>${t("rp.jt." + j.type) || j.type}</td><td>${fmt(j.gap, 2)}</td><td>${fmt(j.fuelleWidth ?? 0, 2)}</td><td>${fmt(j.maxAngleDeg ?? 0, 0)}°</td></tr>`,
    )
    .join("");
  const rmin = minRadius();
  const trackRows: Array<[string, string]> = [
    [t("rp.trackFile"), esc(state.trackName || "—")],
    [t("rp.trackLen"), `${fmt(state.track!.length, 2)} m`],
    [t("rp.trackRmin"), rmin == null ? t("rp.straight") : `${fmt(rmin, 1)} m`],
    [t("lbl.gauge"), `${fmt(state.gauge * 1000, 0)} mm`],
  ];
  const kin = state.kin;
  const kinBlock = kin.enabled
    ? `<h3>${t("sec.kin")}</h3><table class="rp-kv rp-kv2">` +
      (
        [
          // las etiquetas kin.* ya llevan la unidad en corchetes; cant e
          // insuficiencia se guardan en metros (0.12 m = 120 mm) → ×1000 a mm.
          ["kin.h", fmt(kin.h, 2)],
          ["kin.e", fmt(kin.e, 2)],
          ["kin.dMax", fmt(kin.dMax * 1000, 0)],
          ["kin.iMax", fmt(kin.iMax * 1000, 0)],
          ["kin.sigma", fmt(kin.sigma, 2)],
          ["kin.rFull", fmt(kin.rFull, 0)],
        ] as Array<[string, string]>
      )
        .map(([k, val]) => `<tr><th>${t(k)}</th><td>${val}</td></tr>`)
        .join("") +
      `</table>`
    : `<p class="rp-note">${t("rp.kinOff")}</p>`;
  return (
    `<section class="rp-page">` +
    `<h2>1 · ${t("rp.inputs")}</h2>` +
    `<h3>${t("rp.scheme")}</h3>${vehicleSvg()}` +
    `<h3>${t("sec.vehicle")}</h3>` +
    `<table class="rp-tbl"><thead><tr><th>${t("rp.col.id")}</th><th>${t("rp.col.type")}</th><th>${t("rp.col.len")}</th><th>${t("rp.col.width")}</th><th>${t("rp.col.pivot")}</th></tr></thead><tbody>${modRows}</tbody></table>` +
    (jointRows
      ? `<h3>${t("joints.title")}</h3><table class="rp-tbl"><thead><tr><th>R</th><th>${t("rp.col.type")}</th><th>${t("te.joint.gap")}</th><th>${t("te.joint.fuelle")}</th><th>${t("rp.col.limit")}</th></tr></thead><tbody>${jointRows}</tbody></table>`
      : "") +
    `<h3>${t("sec.track")}</h3><table class="rp-kv rp-kv2">${trackRows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join("")}</table>` +
    kinBlock +
    `</section>`
  );
}

function hypothesesPage(): string {
  const items = [1, 2, 3, 4, 5].map((i) => `<li>${t("rp.hyp." + i)}</li>`).join("");
  return (
    `<section class="rp-page">` +
    `<h2>2 · ${t("rp.hypTitle")}</h2>` +
    `<ul class="rp-hyp">${items}</ul>` +
    `<p class="rp-disclaimer">${t("rp.disclaimer")}</p>` +
    `</section>`
  );
}

function resultsPage(): string {
  const s = state.sweep!.summary!;
  const sumRows: Array<[string, string, string]> = [
    [t("cart.maxLeft"), `${fmt(s.maxLeft)} m`, `PK ${pkFmt(s.sMaxLeft)}`],
    [t("cart.maxRight"), `${fmt(s.maxRight)} m`, `PK ${pkFmt(s.sMaxRight)}`],
    [t("cart.totalWidth"), `${fmt(s.totalWidth)} m`, ""],
    [t("cart.overWidth"), `+${fmt(s.totalWidth - 2 * s.bodyHalfWidth)} m`, ""],
  ];
  if (s.kinEnabled) {
    sumRows.push([t("cart.kinLR"), `${fmt(s.kinMaxLeft)} / ${fmt(s.kinMaxRight)} m`, ""]);
    sumRows.push([
      t("cart.kinTotal"),
      `${fmt(s.kinTotalWidth)} m`,
      `+${fmt(s.kinTotalWidth - s.totalWidth)}`,
    ]);
  }
  return (
    `<section class="rp-page">` +
    `<h2>3 · ${t("rp.results")}</h2>` +
    `<table class="rp-tbl rp-sum"><tbody>${sumRows.map(([k, v, w]) => `<tr><th>${k}</th><td class="rp-num">${v}</td><td class="rp-pk">${w}</td></tr>`).join("")}</tbody></table>` +
    `<h3>${t("rp.plan")}</h3>${planSvg()}${legend()}` +
    `<h3>${t("rp.profile")}</h3>${profileSvg()}` +
    `<h3>${t("rp.perPk")}</h3>${perPkTable()}` +
    `<h3>${t("joints.title")}</h3>${jointsResultTable()}` +
    `</section>`
  );
}

function jointsResultTable(): string {
  const rows = (state.sweep!.joints || [])
    .map(
      (j) =>
        `<tr class="${j.exceeded ? "rp-over" : ""}"><td>R${j.idx + 1} ${esc(j.label)}</td><td>${t("rp.jt." + j.type) || j.type}</td><td class="rp-num">${fmt(j.maxAngle, 1)}°</td><td class="rp-pk">PK ${pkFmt(j.pk)}</td><td class="rp-num">${fmt(j.limit, 0)}°</td><td>${j.exceeded ? "⚠ " + t("rp.exceeded") : "✓"}</td></tr>`,
    )
    .join("");
  return `<table class="rp-tbl"><thead><tr><th>${t("rp.col.joint")}</th><th>${t("rp.col.type")}</th><th>${t("rp.col.maxAngle")}</th><th>PK</th><th>${t("rp.col.limit")}</th><th>${t("rp.col.state")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Tabla por PK cada `step` m (submuestreo de `rows`). */
function perPkTable(): string {
  const rows = state.sweep!.rows!;
  if (!rows.length) return "";
  const kinOn = state.sweep!.summary!.kinEnabled;
  const uic = state.uic.enabled ? uic505Profile(state.track!, state.uic, rows) : null;
  const step = 5; // m entre filas del informe
  const out: string[] = [];
  let nextS = rows[0][0];
  rows.forEach((r, i) => {
    if (r[0] + 1e-6 < nextS && i !== rows.length - 1) return;
    nextS = r[0] + step;
    const geoTot = r[2] - r[1];
    const kinTot = kinOn ? r[5] - r[4] : null;
    const uicTot = uic && uic[i] ? uic[i][1] - uic[i][0] : null;
    out.push(
      `<tr><td class="rp-pk">${pkFmt(r[0])}</td><td class="rp-num">${fmt(r[2])}</td><td class="rp-num">${fmt(-r[1])}</td><td class="rp-num">${fmt(geoTot)}</td>` +
        (kinOn ? `<td class="rp-num">${kinTot == null ? "—" : fmt(kinTot)}</td>` : "") +
        (uic ? `<td class="rp-num">${uicTot == null ? "—" : fmt(uicTot)}</td>` : "") +
        `</tr>`,
    );
  });
  const head =
    `<th>PK</th><th>${t("rp.col.left")}</th><th>${t("rp.col.right")}</th><th>${t("rp.col.geo")}</th>` +
    (kinOn ? `<th>${t("rp.col.kin")}</th>` : "") +
    (uic ? `<th>${t("rp.col.uic")}</th>` : "");
  return `<table class="rp-tbl rp-pk-tbl"><thead><tr>${head}</tr></thead><tbody>${out.join("")}</tbody></table>`;
}

function clashPage(): string {
  const c = state.clash!;
  const rows = c.violations
    .slice(0, 60)
    .map(
      (p) =>
        `<tr class="rp-over"><td class="rp-pk">PK ${pkFmt(p.pk)}</td><td class="rp-num">${fmt(p.off)}</td><td class="rp-num">${fmt(p.margin * 1000, 0)} mm</td></tr>`,
    )
    .join("");
  const okMargin = c.minMargin != null && c.minMargin >= c.requiredMargin;
  return (
    `<section class="rp-page">` +
    `<h2>4 · ${t("rp.clash")}</h2>` +
    `<table class="rp-kv rp-kv2">` +
    `<tr><th>${t("rp.reqMargin")}</th><td>${fmt(c.requiredMargin * 1000, 0)} mm</td></tr>` +
    `<tr><th>${t("rp.minMargin")}</th><td class="${okMargin ? "" : "rp-bad"}">${c.minMargin == null ? t("rp.noObs") : fmt(c.minMargin * 1000, 0) + " mm @ PK " + pkFmt(c.minAt!.pk)}</td></tr>` +
    `<tr><th>${t("cart.violations")}</th><td class="${c.violations.length ? "rp-bad" : ""}">${c.violations.length || t("rp.none")}</td></tr>` +
    `<tr><th>${t("rp.against")}</th><td>${c.envelope}</td></tr></table>` +
    (rows
      ? `<table class="rp-tbl"><thead><tr><th>PK</th><th>${t("rp.col.offset")}</th><th>${t("rp.col.margin")}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="rp-note">${t("rp.noViol")}</p>`) +
    `</section>`
  );
}

function uicPage(): string {
  const uic = uic505Profile(state.track!, state.uic, state.sweep!.rows!);
  let uL = -1e9,
    uR = 1e9;
  for (const [r, l] of uic) {
    if (l > uL) uL = l;
    if (r < uR) uR = r;
  }
  const s = state.sweep!.summary!;
  const p = state.uic;
  const paramRows: Array<[string, string]> = [
    ["uic.a", `${fmt(p.a, 2)} m`],
    ["uic.na", `${fmt(p.na, 2)} m`],
    ["uic.p", `${fmt(p.p, 2)} m`],
    ["uic.b", `${fmt(p.b, 3)} m`],
  ];
  return (
    `<section class="rp-page">` +
    `<h2>5 · ${t("rp.uicAnnex")}</h2>` +
    `<table class="rp-kv rp-kv2">${paramRows.map(([k, val]) => `<tr><th>${t(k)}</th><td>${val}</td></tr>`).join("")}</table>` +
    `<table class="rp-tbl rp-sum"><tbody>` +
    `<tr><th>${t("cart.uicEquiv")}</th><td class="rp-num">${fmt(Math.max(uL, -uR))} / ${fmt(Math.min(uL, -uR))} m</td></tr>` +
    `<tr><th>${t("cart.uicDelta")}</th><td class="rp-num">${fmt(uL - uR - s.totalWidth)} m</td></tr></tbody></table>` +
    `<p class="rp-note">${t("rp.uicNote")}</p>` +
    `</section>`
  );
}

// -------------------------------------------------------------------- SVG
/** Ajuste mundo→caja: escala uniforme para encajar los `pts` en `boxW`×`boxH`. */
function fitBox(
  pts: Vec2[],
  boxW: number,
  boxH: number,
  pad: number,
): { X: (p: Vec2) => number; Y: (p: Vec2) => number; w: number; h: number } {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const sc = Math.min((boxW - 2 * pad) / spanX, (boxH - 2 * pad) / spanY);
  const w = spanX * sc + 2 * pad;
  const h = spanY * sc + 2 * pad;
  return {
    X: (p) => pad + (p[0] - minX) * sc,
    Y: (p) => h - pad - (p[1] - minY) * sc,
    w,
    h,
  };
}

function axisPts(): Vec2[] {
  const tr = state.track!;
  const N = Math.max(2, Math.ceil(tr.length / 0.5));
  const out: Vec2[] = [];
  for (let i = 0; i <= N; i++) out.push(tr.pos((tr.length * i) / N));
  return out;
}

/** Puntos de la banda (lado ext + lado int) en coordenadas de mundo. */
function bandWorld(hiIdx: number, loIdx: number): Vec2[] {
  const sw = state.sweep!;
  const st = sw.stations!;
  const pts: Vec2[] = [];
  sw.rows!.forEach((r) => {
    const k = r[3];
    pts.push([st.stX[k] + r[hiIdx] * st.stNx[k], st.stY[k] + r[hiIdx] * st.stNy[k]]);
  });
  for (let i = sw.rows!.length - 1; i >= 0; i--) {
    const r = sw.rows![i];
    const k = r[3];
    pts.push([st.stX[k] + r[loIdx] * st.stNx[k], st.stY[k] + r[loIdx] * st.stNy[k]]);
  }
  return pts;
}

function pathOf(
  pts: Vec2[],
  X: (p: Vec2) => number,
  Y: (p: Vec2) => number,
  close = false,
): string {
  return (
    pts.map((p, i) => `${i ? "L" : "M"}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join(" ") +
    (close ? " Z" : "")
  );
}

/** Planta general vectorial: eje, huella, envolvente cinemática, obstáculos. */
function planSvg(): string {
  const sw = state.sweep!;
  const kinOn = sw.summary!.kinEnabled;
  const all: Vec2[] = [...axisPts(), ...bandWorld(2, 1)];
  if (kinOn) all.push(...bandWorld(5, 4));
  if (state.obstacles) for (const ch of state.obstacles) all.push(...ch);
  const { X, Y, w, h } = fitBox(all, 720, 300, 16);
  const parts: string[] = [
    `<svg class="rp-svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${t("rp.plan")}">`,
  ];
  // envolvente cinemática (debajo), discontinua
  if (kinOn)
    parts.push(
      `<path d="${pathOf(bandWorld(5, 4), X, Y, true)}" fill="none" stroke="${C.kin}" stroke-width="1" stroke-dasharray="5 4"/>`,
    );
  // huella geométrica, continua
  parts.push(
    `<path d="${pathOf(bandWorld(2, 1), X, Y, true)}" fill="${C.footprintFill}" stroke="${C.footprint}" stroke-width="1.2"/>`,
  );
  // eje (trazo-punto)
  parts.push(
    `<path d="${pathOf(axisPts(), X, Y)}" fill="none" stroke="${C.secondary}" stroke-width="1" stroke-dasharray="7 3 2 3"/>`,
  );
  // obstáculos (negro sólido grueso)
  if (state.obstacles)
    for (const ch of state.obstacles) {
      if (ch.length === 1) {
        parts.push(
          `<circle cx="${X(ch[0]).toFixed(1)}" cy="${Y(ch[0]).toFixed(1)}" r="3" fill="none" stroke="${C.obstacle}" stroke-width="1.6"/>`,
        );
      } else {
        parts.push(
          `<path d="${pathOf(ch, X, Y)}" fill="none" stroke="${C.obstacle}" stroke-width="1.6"/>`,
        );
      }
    }
  // invasiones (marcadores)
  if (state.clash)
    for (const p of state.clash.violations.slice(0, 200)) {
      const q: Vec2 = [p.x, p.y];
      parts.push(
        `<circle cx="${X(q).toFixed(1)}" cy="${Y(q).toFixed(1)}" r="2.6" fill="${C.invasion}"/>`,
      );
    }
  parts.push("</svg>");
  return parts.join("");
}

/** Diagrama de semianchos respecto al eje, por PK. B/N: geo continuo, kin discontinuo. */
function profileSvg(): string {
  const rows = state.sweep!.rows!;
  const kinOn = state.sweep!.summary!.kinEnabled;
  const W = 720,
    H = 220,
    padL = 42,
    padB = 26,
    padT = 10,
    padR = 10;
  let maxOff = 0.1;
  for (const r of rows) maxOff = Math.max(maxOff, r[2], -r[1], kinOn ? Math.max(r[5], -r[4]) : 0);
  const s0 = rows[0][0],
    s1 = rows[rows.length - 1][0];
  const span = s1 - s0 || 1;
  const px = (s: number): number => padL + ((s - s0) / span) * (W - padL - padR);
  const py = (off: number): number =>
    H - padB - ((off + maxOff) / (2 * maxOff)) * (H - padT - padB);
  const line = (idx: number, dash: string, col: string): string =>
    `<path d="${rows.map((r, i) => `${i ? "L" : "M"}${px(r[0]).toFixed(1)} ${py(r[idx]).toFixed(1)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="1.2"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const parts: string[] = [
    `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("rp.profile")}">`,
  ];
  // ejes
  parts.push(
    `<line x1="${padL}" y1="${py(0).toFixed(1)}" x2="${W - padR}" y2="${py(0).toFixed(1)}" stroke="${C.hairline}" stroke-width="1"/>`,
  );
  parts.push(
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="${C.hairline}" stroke-width="1"/>`,
  );
  // etiquetas Y (semiancho m) y X (PK)
  for (const off of [-maxOff, 0, maxOff]) {
    parts.push(
      `<text x="4" y="${(py(off) + 3).toFixed(1)}" font-size="9" font-family="monospace" fill="${C.secondary}">${fmt(off, 1)}</text>`,
    );
  }
  for (let i = 0; i <= 5; i++) {
    const s = s0 + (span * i) / 5;
    parts.push(
      `<text x="${px(s).toFixed(1)}" y="${H - 8}" font-size="9" font-family="monospace" text-anchor="middle" fill="${C.secondary}">${pkFmt(s, 0)}</text>`,
    );
  }
  if (kinOn) {
    parts.push(line(5, "5 4", C.kin));
    parts.push(line(4, "5 4", C.kin));
  }
  parts.push(line(2, "", C.footprint));
  parts.push(line(1, "", C.footprint));
  parts.push("</svg>");
  return parts.join("");
}

/** Esquema del vehículo a escala (planta), con cota de longitud total. */
function vehicleSvg(): string {
  const v = state.vehicle;
  const joints = v.joints ?? [];
  const gap = (i: number): number => (i < v.modules.length - 1 ? (joints[i]?.gap ?? 0) : 0);
  const span = v.modules.reduce((a, m, i) => a + m.length + gap(i), 0) || 1;
  const maxW = Math.max(...v.modules.map((m) => m.width), 1);
  const W = 720,
    pad = 20;
  const sc = (W - 2 * pad) / span;
  const drawH = maxW * sc;
  const H = drawH + 2 * pad + 22;
  const cy = pad + drawH / 2;
  const X = (xg: number): number => pad + xg * sc;
  const Y = (yl: number): number => cy - yl * sc;
  const parts: string[] = [
    `<svg class="rp-svg" viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="${t("rp.scheme")}">`,
  ];
  let x0 = 0;
  v.modules.forEach((m, i) => {
    const contour: Vec2[] = m.contour && m.contour.length >= 3 ? m.contour : rectContour(m);
    const susp = m.type === "suspendido";
    const pts = contour.map(([xl, yl]) => `${X(x0 + xl).toFixed(1)},${Y(yl).toFixed(1)}`).join(" ");
    parts.push(
      `<polygon points="${pts}" fill="${C.vehicleFill}" stroke="${susp ? C.fuelle : C.vehicle}" stroke-width="1.2"/>`,
    );
    parts.push(
      `<text x="${X(x0 + m.length / 2).toFixed(1)}" y="${(cy + 3).toFixed(1)}" font-size="9" font-family="monospace" text-anchor="middle" fill="${C.secondary}">${esc(m.id || "M" + (i + 1))}</text>`,
    );
    const pivs =
      m.type === "biBogie"
        ? [m.pivotFrontFromFront ?? m.length / 3, m.pivotRearFromFront ?? (2 * m.length) / 3]
        : m.type === "bogie"
          ? [m.pivotFromFront ?? m.length / 2]
          : [];
    for (const pv of pivs)
      parts.push(
        `<circle cx="${X(x0 + pv).toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${C.vehicle}"/>`,
      );
    x0 += m.length + gap(i);
  });
  // cota de longitud total
  const yD = H - 8;
  parts.push(
    `<line x1="${X(0).toFixed(1)}" y1="${yD}" x2="${X(span).toFixed(1)}" y2="${yD}" stroke="${C.secondary}" stroke-width="0.8"/>`,
    `<text x="${X(span / 2).toFixed(1)}" y="${yD - 3}" font-size="9" font-family="monospace" text-anchor="middle" fill="${C.ink}">${fmt(span, 2)} m</text>`,
  );
  parts.push("</svg>");
  return parts.join("");
}

/** Leyenda del plano — indispensable para B/N (patrón de trazo por serie). */
function legend(): string {
  const items: Array<[string, string, string]> = [
    [C.footprint, "", t("lay.footprint")],
    ...(state.sweep!.summary!.kinEnabled
      ? ([[C.kin, "5 3", t("lay.kin")]] as Array<[string, string, string]>)
      : []),
    [C.secondary, "6 2 2 2", t("rp.axis")],
    [C.obstacle, "", t("lay.obs")],
  ];
  return (
    `<div class="rp-legend">` +
    items
      .map(
        ([col, dash, lbl]) =>
          `<span class="rp-leg"><svg width="26" height="8"><line x1="1" y1="4" x2="25" y2="4" stroke="${col}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ""}/></svg>${lbl}</span>`,
      )
      .join("") +
    `</div>`
  );
}
