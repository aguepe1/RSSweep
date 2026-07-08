// Cajetín de resultados: tabla resumen del barrido, envolvente cinemática,
// comparación UIC, clash y giros de rótula.
import { vehicleLength } from "../engine/index";
import { APP_NAME, VERSION } from "../version";
import { $, fmt } from "./dom";
import { t, numLocale } from "./i18n";
import { pkFmt } from "./pk";
import { state } from "./state";
import { uicRows } from "./compare";

export function renderCartouche(): void {
  $("cartDate").textContent =
    `${APP_NAME} v${VERSION} · ${new Date().toLocaleDateString(numLocale())}`;
  const tbl = $("cartTable");
  if (!state.sweep) {
    tbl.innerHTML = `<div class="k">${t("cart.noCalc")}</div><div class="v">—</div>`;
    return;
  }
  const s = state.sweep.summary!,
    v = state.vehicle;
  const rows: Array<[string, string]> = [
    ["cart.vehicle", `${v.modules.length} ${t("cart.modules")} · ${fmt(vehicleLength(v), 2)} m`],
    ["cart.track", `${state.trackName.slice(0, 26)} · ${fmt(state.track!.length, 1)} m`],
    ["cart.maxLeft", `<span class="v red">${fmt(s.maxLeft)} m</span> @ PK ${pkFmt(s.sMaxLeft)}`],
    ["cart.maxRight", `<span class="v red">${fmt(s.maxRight)} m</span> @ PK ${pkFmt(s.sMaxRight)}`],
    ["cart.totalWidth", `<span class="v amber">${fmt(s.totalWidth)} m</span>`],
    ["cart.overWidth", `+${fmt(s.totalWidth - 2 * s.bodyHalfWidth)} m`],
  ].map(([k, val]) => [t(k), val]);
  if (s.bidirectional) {
    const dir = state.sweep.rowDir;
    const nRev = dir ? dir.reduce((a, b) => a + b, 0) : 0;
    const nTot = dir ? dir.length : 0;
    rows.push([
      t("cart.dir"),
      nRev
        ? `bidireccional · la vuelta gobierna ${nRev}/${nTot} PK`
        : "bidireccional · la ida gobierna todos los PK",
    ]);
  }
  if (s.kinEnabled) {
    rows.push([t("cart.kinLR"), `${fmt(s.kinMaxLeft)} / ${fmt(s.kinMaxRight)} m`]);
    rows.push([
      t("cart.kinTotal"),
      `<span class="v amber">${fmt(s.kinTotalWidth)} m</span> (+${fmt(s.kinTotalWidth - s.totalWidth)})`,
    ]);
  }
  const uicP = uicRows();
  if (uicP) {
    let uL = -1e9,
      uR = 1e9;
    for (const [r2, l2] of uicP) {
      if (l2 > uL) uL = l2;
      if (r2 < uR) uR = r2;
    }
    rows.push([t("cart.uicEquiv"), `${fmt(Math.max(uL, -uR))} / ${fmt(Math.min(uL, -uR))} m`]);
    rows.push([
      t("cart.uicDelta"),
      `<span class="v amber">${fmt(uL - uR - s.totalWidth)} m</span> (ahorro por articulación)`,
    ]);
  }
  if (state.clash) {
    const c = state.clash;
    const ok = c.minMargin != null && c.minMargin >= c.requiredMargin;
    rows.push([
      `${t("cart.clashMargin")} <span style="color:var(--faint)">(env. ${c.envelope})</span>`,
      c.minMargin == null
        ? "sin obstáculos en rango"
        : `<span class="v ${ok ? "" : "red"}">${fmt(c.minMargin * 1000, 0)} mm</span> @ PK ${pkFmt(c.minAt!.pk)}${ok ? "" : " ⚠"}`,
    ]);
    rows.push([
      t("cart.violations"),
      c.violations.length
        ? `<span class="v red">${c.violations.length} punto(s)</span>`
        : "ninguna",
    ]);
  }
  for (const j of state.sweep.joints!) {
    const cls = j.exceeded ? "red" : "";
    rows.push([
      `Rótula R${j.idx + 1} ${j.label} <span style="color:var(--faint)">(${j.type})</span>`,
      `<span class="v ${cls}">${fmt(j.maxAngle, 1)}°</span> @ PK ${pkFmt(j.pk)} · lím ${fmt(j.limit, 0)}°${j.exceeded ? " ⚠" : ""}`,
    ]);
  }
  rows.push([t("cart.steps"), `${s.nSteps} · ${fmt(state.calcMs, 0)} ms`]);
  tbl.innerHTML = rows
    .map(([k, val]) => `<div class="k">${k}</div><div class="v">${val}</div>`)
    .join("");
}
