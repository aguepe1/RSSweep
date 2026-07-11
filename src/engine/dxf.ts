// DXF — import (LINE/ARC/LWPOLYLINE/POLYLINE/SPLINE) y export R12.
import type {
  Chain,
  DXFParseResult,
  JoinOpts,
  JoinResult,
  RailsToAxisResult,
  SweepResult,
  Track,
  Vec2,
} from "../types";
import { vadd, vlen, vscale, vsub } from "./vec";

type Pair = [number, string];
interface SimpleEntity {
  typ: string;
  data: Pair[];
}
interface PolylineEntity {
  typ: "POLYLINE";
  verts: SimpleEntity[];
  layer: string;
}
type Entity = SimpleEntity | PolylineEntity;

/** $INSUNITS del HEADER → nombre y factor a metros (E2-3). Los códigos no listados
 *  se asumen metros con aviso (unitless o desconocido). */
const INSUNITS: Record<number, { name: string; scale: number }> = {
  0: { name: "sin unidades", scale: 1 },
  1: { name: "pulgadas", scale: 0.0254 },
  2: { name: "pies", scale: 0.3048 },
  4: { name: "milímetros", scale: 0.001 },
  5: { name: "centímetros", scale: 0.01 },
  6: { name: "metros", scale: 1 },
  9: { name: "micras", scale: 1e-6 },
  10: { name: "yardas", scale: 0.9144 },
  14: { name: "decímetros", scale: 0.1 },
  21: { name: "pies (US survey)", scale: 1200 / 3937 },
};

/** Evalúa una curva NURBS (SPLINE) por De Boor y la muestrea a `maxStep` (E2-3).
 *  Soporta racional (pesos). Si faltan nudos, genera un vector clamped uniforme. */
function sampleSpline(
  ctrl: Vec2[],
  degIn: number,
  knotsIn: number[],
  weights: number[] | null,
  maxStep: number,
): Vec2[] {
  const n = ctrl.length - 1;
  const p = Math.max(1, Math.min(degIn || 3, n));
  let U = knotsIn;
  if (!U || U.length !== n + p + 2) {
    // vector de nudos clamped uniforme: p+1 ceros, interior uniforme, p+1 unos.
    U = [];
    for (let k = 0; k <= p; k++) U.push(0);
    const inner = n - p;
    for (let k = 1; k <= inner; k++) U.push(k / (inner + 1));
    for (let k = 0; k <= p; k++) U.push(1);
  }
  const w = weights && weights.length === ctrl.length ? weights : ctrl.map(() => 1);
  const u0 = U[p];
  const u1 = U[n + 1];
  const findSpan = (u: number): number => {
    if (u >= U[n + 1]) return n;
    if (u <= U[p]) return p;
    let lo = p;
    let hi = n + 1;
    let mid = (lo + hi) >> 1;
    while (u < U[mid] || u >= U[mid + 1]) {
      if (u < U[mid]) hi = mid;
      else lo = mid;
      mid = (lo + hi) >> 1;
    }
    return mid;
  };
  const evalAt = (u: number): Vec2 => {
    const span = findSpan(u);
    // De Boor en coordenadas homogéneas (x·w, y·w, w).
    const dx: number[] = [];
    const dy: number[] = [];
    const dw: number[] = [];
    for (let j = 0; j <= p; j++) {
      const idx = span - p + j;
      dx[j] = ctrl[idx][0] * w[idx];
      dy[j] = ctrl[idx][1] * w[idx];
      dw[j] = w[idx];
    }
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const idx = span - p + j;
        const denom = U[idx + p - r + 1] - U[idx];
        const a = denom > 1e-12 ? (u - U[idx]) / denom : 0;
        dx[j] = (1 - a) * dx[j - 1] + a * dx[j];
        dy[j] = (1 - a) * dy[j - 1] + a * dy[j];
        dw[j] = (1 - a) * dw[j - 1] + a * dw[j];
      }
    }
    const ww = dw[p] || 1;
    return [dx[p] / ww, dy[p] / ww];
  };
  // longitud del polígono de control → nº de muestras.
  let ctrlLen = 0;
  for (let k = 1; k < ctrl.length; k++) ctrlLen += vlen(vsub(ctrl[k], ctrl[k - 1]));
  const nSamp = Math.max(16, Math.min(20000, Math.ceil(ctrlLen / maxStep)));
  const pts: Vec2[] = [];
  for (let k = 0; k <= nSamp; k++) pts.push(evalAt(u0 + ((u1 - u0) * k) / nSamp));
  return pts;
}

/** Parser DXF. Soporta LINE, ARC, LWPOLYLINE (con bulge), POLYLINE/VERTEX, SPLINE.
 *  Aplica $INSUNITS (conversión a metros con aviso) y anota la capa de cada cadena. */
export function parseDXF(text: string): DXFParseResult {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  }
  // $INSUNITS del HEADER (code 9 "$INSUNITS" seguido de code 70 con el valor).
  let unitCode = -1;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 9 && pairs[i][1] === "$INSUNITS") {
      for (let j = i + 1; j < pairs.length && pairs[j][0] !== 9; j++) {
        if (pairs[j][0] === 70) {
          unitCode = parseInt(pairs[j][1], 10);
          break;
        }
      }
      break;
    }
  }
  const unit = INSUNITS[unitCode] || { name: "desconocidas", scale: 1 };
  const scale = unit.scale;

  let i0 = -1;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 2 && pairs[i][1] === "ENTITIES") {
      i0 = i + 1;
      break;
    }
  }
  if (i0 < 0) return { chains: [], warnings: ["No se encontro la seccion ENTITIES en el DXF."] };

  const entities: Entity[] = [];
  const ignored = new Set<string>();
  let i = i0;
  function collect(start: number): [SimpleEntity, number] {
    const typ = pairs[start][1];
    const data: Pair[] = [];
    let j = start + 1;
    while (j < pairs.length && pairs[j][0] !== 0) {
      data.push(pairs[j]);
      j++;
    }
    return [{ typ, data }, j];
  }
  const raw: SimpleEntity[] = [];
  while (i < pairs.length) {
    if (pairs[i][0] === 0) {
      if (pairs[i][1] === "ENDSEC") break;
      const [ent, next] = collect(i);
      raw.push(ent);
      i = next;
    } else i++;
  }
  function gets(data: Pair[], code: number, dflt: string): string {
    for (const [c, v] of data) if (c === code) return v;
    return dflt;
  }
  for (let r = 0; r < raw.length; r++) {
    const e = raw[r];
    if (e.typ === "POLYLINE") {
      const verts: SimpleEntity[] = [];
      let j = r + 1;
      while (j < raw.length && raw[j].typ === "VERTEX") {
        verts.push(raw[j]);
        j++;
      }
      if (j < raw.length && raw[j].typ === "SEQEND") j++;
      entities.push({ typ: "POLYLINE", verts, layer: gets(e.data, 8, "0") });
      r = j - 1;
    } else if (
      e.typ === "LINE" ||
      e.typ === "ARC" ||
      e.typ === "LWPOLYLINE" ||
      e.typ === "SPLINE"
    ) {
      entities.push(e);
    } else if (e.typ !== "SEQEND" && e.typ !== "VERTEX") {
      ignored.add(e.typ);
    }
  }

  function getf(data: Pair[], code: number, dflt: number): number {
    for (const [c, v] of data) if (c === code) return parseFloat(v);
    return dflt;
  }
  function getAll(data: Pair[], code: number): number[] {
    const out: number[] = [];
    for (const [c, v] of data) if (c === code) out.push(parseFloat(v));
    return out;
  }
  function bulgeToPoints(p1: Vec2, p2: Vec2, bulge: number, maxStep: number): Vec2[] {
    const theta = 4 * Math.atan(bulge);
    const chord = vlen(vsub(p2, p1));
    if (chord < 1e-9) return [];
    const R = chord / (2 * Math.sin(Math.abs(theta) / 2));
    const mid = vscale(vadd(p1, p2), 0.5);
    const perp: Vec2 = [-(p2[1] - p1[1]) / chord, (p2[0] - p1[0]) / chord];
    const h = R * Math.cos(Math.abs(theta) / 2) * Math.sign(theta);
    const c = vadd(mid, vscale(perp, -h));
    const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    const nSeg = Math.max(2, Math.ceil((Math.abs(theta) * R) / maxStep));
    const pts: Vec2[] = [];
    for (let k = 1; k < nSeg; k++) {
      const a = a1 + (theta * k) / nSeg;
      pts.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
    }
    return pts;
  }

  const MAXSTEP = 0.05;
  const chains: Chain[] = [];
  const chainLayers: string[] = [];
  const push = (pts: Vec2[], layer: string): void => {
    if (pts.length >= 2) {
      chains.push(pts);
      chainLayers.push(layer);
    }
  };
  for (const e of entities) {
    const layer =
      e.typ === "POLYLINE" ? (e as PolylineEntity).layer : gets((e as SimpleEntity).data, 8, "0");
    if (e.typ === "LINE") {
      const d = e.data;
      push(
        [
          [getf(d, 10, 0), getf(d, 20, 0)],
          [getf(d, 11, 0), getf(d, 21, 0)],
        ],
        layer,
      );
    } else if (e.typ === "ARC") {
      const d = e.data;
      const cx = getf(d, 10, 0);
      const cy = getf(d, 20, 0);
      const R = getf(d, 40, 1);
      const a1 = (getf(d, 50, 0) * Math.PI) / 180;
      let a2 = (getf(d, 51, 0) * Math.PI) / 180;
      while (a2 <= a1) a2 += 2 * Math.PI;
      const nSeg = Math.max(2, Math.ceil(((a2 - a1) * R) / MAXSTEP));
      const pts: Vec2[] = [];
      for (let k = 0; k <= nSeg; k++) {
        const a = a1 + ((a2 - a1) * k) / nSeg;
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      }
      push(pts, layer);
    } else if (e.typ === "SPLINE") {
      const d = e.data;
      const degree = getf(d, 71, 3);
      const knots = getAll(d, 40);
      const xs = getAll(d, 10);
      const ys = getAll(d, 20);
      const weights = getAll(d, 41);
      const ctrl: Vec2[] = [];
      for (let k = 0; k < Math.min(xs.length, ys.length); k++) ctrl.push([xs[k], ys[k]]);
      if (ctrl.length >= 2) {
        push(sampleSpline(ctrl, degree, knots, weights.length ? weights : null, MAXSTEP), layer);
      } else {
        // sin puntos de control: intenta con los puntos de ajuste (11/21).
        const fx = getAll(d, 11);
        const fy = getAll(d, 21);
        const fit: Vec2[] = [];
        for (let k = 0; k < Math.min(fx.length, fy.length); k++) fit.push([fx[k], fy[k]]);
        push(fit, layer);
      }
    } else if (e.typ === "LWPOLYLINE") {
      const verts: Array<{ p: Vec2; bulge: number }> = [];
      let cur: { p: Vec2; bulge: number } | null = null;
      for (const [c, v] of e.data) {
        if (c === 10) {
          cur = { p: [parseFloat(v), 0], bulge: 0 };
          verts.push(cur);
        } else if (c === 20 && cur) cur.p[1] = parseFloat(v);
        else if (c === 42 && cur) cur.bulge = parseFloat(v);
      }
      const pts: Vec2[] = [];
      for (let k = 0; k < verts.length; k++) {
        pts.push(verts[k].p);
        if (k + 1 < verts.length && Math.abs(verts[k].bulge) > 1e-12) {
          pts.push(...bulgeToPoints(verts[k].p, verts[k + 1].p, verts[k].bulge, MAXSTEP));
        }
      }
      push(pts, layer);
    } else if (e.typ === "POLYLINE") {
      const pv = e as PolylineEntity;
      const pts: Vec2[] = [];
      for (let k = 0; k < pv.verts.length; k++) {
        const p: Vec2 = [getf(pv.verts[k].data, 10, 0), getf(pv.verts[k].data, 20, 0)];
        pts.push(p);
        const b = getf(pv.verts[k].data, 42, 0);
        if (k + 1 < pv.verts.length && Math.abs(b) > 1e-12) {
          const p2: Vec2 = [getf(pv.verts[k + 1].data, 10, 0), getf(pv.verts[k + 1].data, 20, 0)];
          pts.push(...bulgeToPoints(p, p2, b, MAXSTEP));
        }
      }
      push(pts, layer);
    }
  }
  // conversión de unidades a metros (E2-3): escala todos los vértices.
  if (scale !== 1)
    for (const ch of chains)
      for (const p of ch) {
        p[0] *= scale;
        p[1] *= scale;
      }

  const warnings: string[] = [];
  if (ignored.size)
    warnings.push(
      "Entidades ignoradas (no soportadas): " +
        [...ignored].join(", ") +
        ". Convierte a polilinea/spline en CAD antes de exportar.",
    );
  if (unitCode >= 0 && scale !== 1)
    warnings.push(`Unidades del dibujo: ${unit.name} → convertidas a metros (×${scale}).`);
  else if (unitCode <= 0)
    warnings.push("Sin $INSUNITS en el DXF: se asumen metros (verifica la escala).");
  const layers = [...new Set(chainLayers)].sort();
  return {
    chains,
    warnings,
    chainLayers,
    layers,
    units: { code: unitCode, name: unit.name, scale },
  };
}

/**
 * Encadena entidades sueltas en una única polilínea por proximidad de extremos.
 * `opts` (E2-3): `layer` filtra por capa de eje, `flip` invierte el sentido de
 * marcha del eje resultante. Compatible con la llamada previa `joinChains(chains)`.
 */
export function joinChains(chains: Chain[], opts: JoinOpts = {}): JoinResult {
  const tol = opts.tol ?? 0.05;
  const preWarn: string[] = [];
  if (opts.layer && opts.chainLayers && opts.chainLayers.length === chains.length) {
    const filtered = chains.filter((_, i) => opts.chainLayers![i] === opts.layer);
    if (filtered.length) chains = filtered;
    else preWarn.push(`La capa "${opts.layer}" no tiene geometría; se usan todas las capas.`);
  }
  if (chains.length === 0)
    return { points: null, warnings: ["El DXF no contiene geometria importable."] };
  const pool = chains.map((c) => c.slice());
  let bi = 0;
  let bl = -1;
  for (let i = 0; i < pool.length; i++) {
    let L = 0;
    for (let k = 1; k < pool[i].length; k++) L += vlen(vsub(pool[i][k], pool[i][k - 1]));
    if (L > bl) {
      bl = L;
      bi = i;
    }
  }
  let path = pool.splice(bi, 1)[0];
  let grew = true;
  while (grew && pool.length) {
    grew = false;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const pS = path[0];
      const pE = path[path.length - 1];
      const cS = c[0];
      const cE = c[c.length - 1];
      if (vlen(vsub(pE, cS)) < tol) {
        path = path.concat(c.slice(1));
        pool.splice(i, 1);
        grew = true;
        break;
      }
      if (vlen(vsub(pE, cE)) < tol) {
        path = path.concat(c.slice(0, -1).reverse());
        pool.splice(i, 1);
        grew = true;
        break;
      }
      if (vlen(vsub(pS, cE)) < tol) {
        path = c.slice(0, -1).concat(path);
        pool.splice(i, 1);
        grew = true;
        break;
      }
      if (vlen(vsub(pS, cS)) < tol) {
        path = c.slice(1).reverse().concat(path);
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
  }
  const warnings: string[] = preWarn;
  if (pool.length)
    warnings.push(`${pool.length} entidad(es) no conectadas al eje principal — se han descartado.`);
  if (opts.flip) path = path.slice().reverse();
  return { points: path, warnings };
}

/** Une por proximidad de extremos y devuelve UNA polilínea por componente conexa,
 *  ordenadas por longitud descendente. Base de la detección de dos carriles (E4-B1). */
function joinAllComponents(chains: Chain[], tol: number): Chain[] {
  const pool = chains.map((c) => c.slice());
  const out: Chain[] = [];
  while (pool.length) {
    let path = pool.shift()!;
    let grew = true;
    while (grew && pool.length) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        const pS = path[0];
        const pE = path[path.length - 1];
        const cS = c[0];
        const cE = c[c.length - 1];
        if (vlen(vsub(pE, cS)) < tol) {
          path = path.concat(c.slice(1));
        } else if (vlen(vsub(pE, cE)) < tol) {
          path = path.concat(c.slice(0, -1).reverse());
        } else if (vlen(vsub(pS, cE)) < tol) {
          path = c.slice(0, -1).concat(path);
        } else if (vlen(vsub(pS, cS)) < tol) {
          path = c.slice(1).reverse().concat(path);
        } else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(path);
  }
  const len = (c: Chain): number => {
    let L = 0;
    for (let k = 1; k < c.length; k++) L += vlen(vsub(c[k], c[k - 1]));
    return L;
  };
  return out.sort((a, b) => len(b) - len(a));
}

/** Punto más cercano de `w` sobre la polilínea `chain` y su distancia. */
function nearestOnChain(w: Vec2, chain: Chain): { pt: Vec2; d: number } {
  let best = Infinity;
  let bp: Vec2 = chain[0];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-12;
    let u = ((w[0] - a[0]) * dx + (w[1] - a[1]) * dy) / len2;
    u = Math.max(0, Math.min(1, u));
    const fx = a[0] + u * dx;
    const fy = a[1] + u * dy;
    const d = (w[0] - fx) ** 2 + (w[1] - fy) ** 2;
    if (d < best) {
      best = d;
      bp = [fx, fy];
    }
  }
  return { pt: bp, d: Math.sqrt(best) };
}

/**
 * Deriva el eje de vía (línea media) y el ancho de vía `gauge` a partir de dos
 * carriles importados (E4-B1). Agrupa las cadenas en componentes conexas, toma las
 * dos más largas como carriles, y para cada vértice del carril mayor proyecta sobre
 * el otro: el punto medio traza el eje y la distancia mide la separación (gauge =
 * mediana de las separaciones, robusta a extremos). El eje resultante es la misma
 * línea media que el motor ya asume para vía de ancho fijo, así que no altera la
 * envolvente ni los valores dorados: cambia de dónde SALE el eje, no cómo se barre.
 */
export function railsToAxis(chains: Chain[], opts: JoinOpts = {}): RailsToAxisResult {
  const tol = opts.tol ?? 0.05;
  const comps = joinAllComponents(chains, tol);
  const warnings: string[] = [];
  if (comps.length < 2)
    return {
      axis: null,
      gauge: null,
      warnings: [
        "Se necesitan dos carriles: sólo se halló una polilínea conexa. Comprueba que ambos rieles estén en el DXF.",
      ],
    };
  if (comps.length > 2)
    warnings.push(
      `Se hallaron ${comps.length} polilíneas; se toman las dos más largas como carriles.`,
    );
  const railA = comps[0];
  const railB = comps[1];
  const axis: Chain = [];
  const gaps: number[] = [];
  for (const p of railA) {
    const nb = nearestOnChain(p, railB);
    axis.push([(p[0] + nb.pt[0]) / 2, (p[1] + nb.pt[1]) / 2]);
    gaps.push(nb.d);
  }
  gaps.sort((a, b) => a - b);
  const gauge = gaps[gaps.length >> 1];
  if (opts.flip) axis.reverse();
  return { axis, gauge, warnings };
}

/** Importa un DXF de obstáculos: TODAS las cadenas se conservan (no se encadenan). */
export function obstaclesFromDXF(text: string): { obstacles: Chain[]; warnings: string[] } {
  const { chains, warnings } = parseDXF(text);
  return { obstacles: chains, warnings };
}

/** Export R12 (POLYLINE/VERTEX/SEQEND): compatible con AutoCAD, ezdxf, QGIS. */
export function writeDXF(track: Track, sweep: SweepResult): string {
  const L: string[] = [];
  const P = (c: number | string, v: number | string): void => {
    L.push(String(c));
    L.push(String(v));
  };
  P(0, "SECTION");
  P(2, "HEADER");
  P(9, "$ACADVER");
  P(1, "AC1009");
  P(0, "ENDSEC");
  P(0, "SECTION");
  P(2, "TABLES");
  P(0, "TABLE");
  P(2, "LAYER");
  P(70, 3);
  const layers: Array<[string, number]> = [
    ["EJE_VIA", 3],
    ["HUELLA_IZQ", 1],
    ["HUELLA_DCHA", 1],
    ["ENVOLVENTE_KIN_IZQ", 2],
    ["ENVOLVENTE_KIN_DCHA", 2],
  ];
  for (const [name, color] of layers) {
    P(0, "LAYER");
    P(2, name);
    P(70, 0);
    P(62, color);
    P(6, "CONTINUOUS");
  }
  P(0, "ENDTAB");
  P(0, "ENDSEC");
  P(0, "SECTION");
  P(2, "ENTITIES");
  function poly(pts: Vec2[], layer: string): void {
    P(0, "POLYLINE");
    P(8, layer);
    P(66, 1);
    P(70, 0);
    for (const [x, y] of pts) {
      P(0, "VERTEX");
      P(8, layer);
      P(10, x.toFixed(4));
      P(20, y.toFixed(4));
      P(30, "0.0");
    }
    P(0, "SEQEND");
    P(8, layer);
  }
  const cl: Vec2[] = [];
  for (let sv = 0; sv <= track.length; sv += 0.25) cl.push(track.pos(sv));
  poly(cl, "EJE_VIA");
  const lb: Vec2[] = [];
  const rb: Vec2[] = [];
  const lk: Vec2[] = [];
  const rk: Vec2[] = [];
  const st = sweep.stations!;
  for (const [, r, l, k, rkin, lkin] of sweep.rows!) {
    lb.push([st.stX[k] + l * st.stNx[k], st.stY[k] + l * st.stNy[k]]);
    rb.push([st.stX[k] + r * st.stNx[k], st.stY[k] + r * st.stNy[k]]);
    if (sweep.summary!.kinEnabled) {
      lk.push([st.stX[k] + lkin * st.stNx[k], st.stY[k] + lkin * st.stNy[k]]);
      rk.push([st.stX[k] + rkin * st.stNx[k], st.stY[k] + rkin * st.stNy[k]]);
    }
  }
  poly(lb, "HUELLA_IZQ");
  poly(rb, "HUELLA_DCHA");
  if (lk.length) {
    poly(lk, "ENVOLVENTE_KIN_IZQ");
    poly(rk, "ENVOLVENTE_KIN_DCHA");
  }
  P(0, "ENDSEC");
  P(0, "EOF");
  return L.join("\n");
}
