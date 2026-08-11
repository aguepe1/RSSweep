// EXPORT XLSX (E4-3) — libro Excel con hojas Parámetros / Perfil / Rótulas / Clash /
// UIC, construido con el escritor propio `buildXlsx` (sin dependencias). La hoja
// «Perfil» usa `profileTable`, paritaria con el CSV de perfil. Solo presentación
// sobre `state`; no toca el motor.
import { buildXlsx, profileTable, uic505Profile, vehicleLength } from "../engine/index";
import type { XlsxCell, XlsxSheet } from "../engine/index";
import { $, downloadBytes, fmt } from "./dom";
import { state } from "./state";
import { pkVal } from "./pk";
import { t } from "./i18n";
import { APP_NAME, VERSION } from "../version";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const r = (x: number, d: number): number => Math.round(x * 10 ** d) / 10 ** d;

export function initXlsxExport(): void {
  $("menuXlsxOut").addEventListener("click", exportXlsx);
}

function paramsSheet(): XlsxSheet {
  const s = state.sweep!.summary!;
  const v = state.vehicle;
  const rows: XlsxCell[][] = [
    [t("rp.project"), state.trackName || "—"],
    [t("rp.trackLen"), r(state.track!.length, 2)],
    [t("lbl.gauge"), Math.round(state.gauge * 1000)],
    [t("rp.vehicle"), `${v.modules.length} · ${fmt(vehicleLength(v), 2)} m`],
    [t("cart.totalWidth"), r(s.totalWidth, 4)],
    [t("cart.overWidth"), r(s.totalWidth - 2 * s.bodyHalfWidth, 4)],
  ];
  if (s.kinEnabled) rows.push([t("cart.kinTotal"), r(s.kinTotalWidth, 4)]);
  if (state.consist.enabled) {
    const cp = state.consist.coupler;
    rows.push([
      t("cart.consist"),
      `${t("consist.type." + cp.type)} · ${fmt(cp.length, 2)} m · ±${fmt(cp.maxAngleDeg, 0)}°`,
    ]);
  }
  rows.push([t("rp.version"), `${APP_NAME} v${VERSION}`]);
  return {
    name: t("xlsx.params"),
    headers: [t("xlsx.param"), t("xlsx.value")],
    rows,
    cols: [30, 34],
  };
}

function profileSheet(): XlsxSheet {
  const tbl = profileTable(state.sweep!, pkVal);
  return {
    name: t("xlsx.profile"),
    headers: tbl.headers,
    rows: tbl.rows as XlsxCell[][],
    cols: tbl.headers.map(() => 14),
  };
}

function jointsSheet(): XlsxSheet {
  const rows: XlsxCell[][] = (state.sweep!.joints ?? []).map((j) => [
    `R${j.idx + 1}`,
    j.label,
    j.type,
    r(j.maxAngle, 2),
    r(pkVal(j.pk), 2),
    r(j.limit, 1),
    j.exceeded ? { v: t("rp.exceeded"), fill: "red" } : "OK",
  ]);
  return {
    name: t("xlsx.joints"),
    headers: [
      "R",
      t("rp.col.joint"),
      t("rp.col.type"),
      t("rp.col.maxAngle"),
      "PK",
      t("rp.col.limit"),
      t("rp.col.state"),
    ],
    rows,
    cols: [6, 16, 12, 12, 12, 10, 12],
  };
}

function clashSheet(): XlsxSheet {
  const rows: XlsxCell[][] = (state.clash!.points ?? []).map((p) => [
    r(pkVal(p.pk), 2),
    r(p.x, 3),
    r(p.y, 3),
    r(p.off, 3),
    Math.round(p.margin * 1000),
    p.viol ? { v: "INVASION", fill: "red" } : "OK",
  ]);
  return {
    name: t("xlsx.clash"),
    headers: ["PK", "x", "y", t("rp.col.offset"), t("rp.col.margin") + " (mm)", t("rp.col.state")],
    rows,
    cols: [12, 12, 12, 12, 14, 12],
  };
}

function uicSheet(): XlsxSheet {
  const prof = uic505Profile(state.track!, state.uic, state.sweep!.rows!);
  const rows: XlsxCell[][] = state.sweep!.rows!.map((row, i) => {
    const u = prof[i] ?? [0, 0];
    return [r(pkVal(row[0]), 3), r(-u[0], 4), r(u[1], 4), r(u[1] - u[0], 4)];
  });
  return {
    name: t("xlsx.uic"),
    headers: ["pk_m", "uic_dcha_m", "uic_izq_m", "uic_ancho_m"],
    rows,
    cols: [14, 14, 14, 14],
  };
}

function exportXlsx(): void {
  if (!state.sweep || !state.sweep.summary || !state.track) return;
  const sheets: XlsxSheet[] = [paramsSheet(), profileSheet(), jointsSheet()];
  if (state.clash) sheets.push(clashSheet());
  if (state.uic.enabled) sheets.push(uicSheet());
  downloadBytes("barrido.xlsx", buildXlsx(sheets), XLSX_MIME);
}
