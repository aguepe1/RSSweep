// UIC 505-1 — comparación con los salientes geométricos clásicos.
// NOTA: UIC 505-1/EN 15273 excluyen tranvías y asumen cuerpo rígido entre
// pivotes; se usan aquí como referencia analítica de primer orden.
import type { ProfileRow, Track, UicParams, Vehicle } from "../types";

/** Vehículo equivalente: peor pareja de pivotes consecutivos + peor voladizo. */
export function uicParamsFromVehicle(v: Vehicle): UicParams {
  const mods = v.modules;
  let pos = 0;
  const pivots: number[] = [];
  for (const m of mods) {
    if (m.type === "bogie") pivots.push(pos + (m.pivotFromFront ?? 0));
    else if (m.type === "biBogie") {
      pivots.push(pos + (m.pivotFrontFromFront ?? 0));
      pivots.push(pos + (m.pivotRearFromFront ?? 0));
    }
    pos += m.length;
  }
  const total = pos;
  let a = 0;
  for (let i = 1; i < pivots.length; i++) a = Math.max(a, pivots[i] - pivots[i - 1]);
  const na = Math.max(
    pivots.length ? pivots[0] : 0,
    pivots.length ? total - pivots[pivots.length - 1] : 0,
  );
  const b = Math.max(...mods.map((m) => m.width)) / 2;
  return { a: +a.toFixed(3), na: +na.toFixed(3), p: v.wheelbase || 1.8, b: +b.toFixed(3) };
}

/** Perfil analítico por estación: devuelve [[dcha, izq], ...] por fila. */
export function uic505Profile(
  track: Track,
  params: UicParams,
  rows: ProfileRow[],
): Array<[number, number]> {
  const { a, na, p, b } = params;
  const out: Array<[number, number]> = [];
  for (const row of rows) {
    const s = row[0];
    const dh = 1.0;
    let dth = track.heading(Math.min(track.length, s + dh)) - track.heading(Math.max(0, s - dh));
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    const kv = dth / (2 * dh);
    const absk = Math.abs(kv);
    const dgi = ((a * a) / 8 + (p * p) / 8) * absk;
    const dga = Math.max(0, ((a * na + na * na) / 2) * absk - ((p * p) / 8) * absk);
    const inner = b + dgi;
    const outer = b + dga;
    if (kv > 1e-6) out.push([-outer, inner]);
    else if (kv < -1e-6) out.push([-inner, outer]);
    else out.push([-b, b]);
  }
  return out;
}
