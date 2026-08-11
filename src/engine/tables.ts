// TABLAS TABULARES — filas de datos derivadas del barrido para exportación (CSV/
// XLSX). Puro (sin DOM): recibe el `SweepResult` y una función PK. `profileTable`
// reproduce EXACTAMENTE las columnas y valores del CSV de perfil (mismas fórmulas
// y redondeos), de modo que la hoja «Perfil» del XLSX y el CSV son paritarios (E4-3).
import type { SweepResult } from "../types";

export interface Table {
  headers: string[];
  rows: Array<Array<number | string>>;
}

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const r3 = (x: number): number => Math.round(x * 1e3) / 1e3;

/** Perfil de semianchos por PK — mismas columnas/valores que el CSV de perfil. */
export function profileTable(sweep: SweepResult, pkOf: (s: number) => number): Table {
  const kinOn = !!sweep.summary?.kinEnabled;
  const dir = sweep.rowDir;
  const headers = ["pk_m", "offset_dcha_m", "offset_izq_m", "ancho_m"];
  if (kinOn) headers.push("kin_dcha_m", "kin_izq_m", "kin_ancho_m");
  if (dir) headers.push("sentido");
  const rows: Array<Array<number | string>> = [];
  (sweep.rows ?? []).forEach(([s, right, left, , rk, lk], i) => {
    const row: Array<number | string> = [r3(pkOf(s)), r4(right), r4(left), r4(left - right)];
    if (kinOn) row.push(r4(rk), r4(lk), r4(lk - rk));
    if (dir) row.push(dir[i] ? "vuelta" : "ida");
    rows.push(row);
  });
  return { headers, rows };
}
