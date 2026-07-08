// LANDXML — import de alignment LandXML 1.2 con PK de proyecto (E2-4).
//  · Geometría por CoordGeom: Line / Curve (arco) / Spiral (clotoide).
//  · PK de proyecto: staStart + ecuaciones de PK (StaEquation) → PkMap.
// El motor trabaja SIEMPRE en longitud de arco s (m desde el inicio del eje); el
// PkMap traduce s → PK de proyecto solo en presentación e informes.
import type { LandXMLResult, PkMap, Vec2 } from "../types";

/** PK de proyecto en la abscisa de arco `s` (identidad si no hay mapa). */
export function pkAt(map: PkMap | null | undefined, s: number): number {
  if (!map || !map.length) return s;
  let i = 0;
  for (let j = 0; j < map.length; j++) {
    if (map[j].s <= s + 1e-9) i = j;
    else break;
  }
  return map[i].pk + (s - map[i].s);
}

/** Inversa: abscisa de arco `s` para un PK de proyecto (identidad si no hay mapa).
 *  Con ecuaciones de PK que solapen, devuelve la primera coincidencia. */
export function sAtPk(map: PkMap | null | undefined, pk: number): number {
  if (!map || !map.length) return pk;
  for (let i = 0; i < map.length; i++) {
    const pk0 = map[i].pk;
    const sEnd = i + 1 < map.length ? map[i + 1].s : Infinity;
    const pkEnd = pk0 + (sEnd - map[i].s);
    if (pk >= pk0 - 1e-9 && pk < pkEnd) return map[i].s + (pk - pk0);
  }
  const last = map[map.length - 1];
  return last.s + (pk - last.pk);
}

// ---------------------------------------------------------------- parser XML
interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/** Parser XML mínimo (sin dependencias, corre en Node y navegador). Suficiente
 *  para la estructura anidada de LandXML; no valida esquema ni entidades. */
function parseXML(src: string): XmlNode | null {
  // fuera comentarios, CDATA, PI y DOCTYPE.
  const text = src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
  const tagRe = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  const root: XmlNode = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  let last = 0;
  let m: RegExpExecArray | null;
  const attrRe = /([\w.:-]+)\s*=\s*"([^"]*)"/g;
  while ((m = tagRe.exec(text))) {
    const between = text.slice(last, m.index).trim();
    if (between) stack[stack.length - 1].text += between;
    last = tagRe.lastIndex;
    const closing = m[1] === "/";
    const selfClose = m[4] === "/";
    const tag = m[2];
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((am = attrRe.exec(m[3]))) attrs[am[1]] = am[2];
    const node: XmlNode = { tag, attrs, children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children.length ? root : null;
}

function findFirst(node: XmlNode, tag: string): XmlNode | null {
  if (node.tag === tag) return node;
  for (const c of node.children) {
    const r = findFirst(c, tag);
    if (r) return r;
  }
  return null;
}

function childrenByTag(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter((c) => c.tag === tag);
}

/** Punto LandXML "northing easting [elev]" (N=Y, E=X) → [x, y] del plano. */
function pointOf(node: XmlNode | undefined): Vec2 | null {
  if (!node) return null;
  const nums = node.text.trim().split(/\s+/).map(parseFloat);
  if (nums.length < 2 || !isFinite(nums[0]) || !isFinite(nums[1])) return null;
  return [nums[1], nums[0]]; // x = easting, y = northing
}

const STEP = 0.05; // muestreo geométrico (m), igual que el import DXF.

function sampleLine(a: Vec2, b: Vec2): Vec2[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(L / STEP));
  const out: Vec2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  }
  return out;
}

function sampleArc(a: Vec2, c: Vec2, b: Vec2, ccw: boolean): Vec2[] {
  const R = Math.hypot(a[0] - c[0], a[1] - c[1]);
  let a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  let delta = a1 - a0;
  if (ccw) {
    while (delta <= 1e-9) delta += 2 * Math.PI;
  } else {
    while (delta >= -1e-9) delta -= 2 * Math.PI;
  }
  const L = Math.abs(delta) * R;
  const n = Math.max(1, Math.round(L / STEP));
  const out: Vec2[] = [];
  for (let i = 1; i <= n; i++) {
    const ang = a0 + (delta * i) / n;
    out.push([c[0] + R * Math.cos(ang), c[1] + R * Math.sin(ang)]);
  }
  return out;
}

/** Clotoide: curvatura lineal de 1/rStart a 1/rEnd sobre la longitud L. Rumbo
 *  inicial hacia el PI (intersección de tangentes). Integración de Euler fina. */
function sampleSpiral(
  a: Vec2,
  pi: Vec2,
  L: number,
  rStart: number,
  rEnd: number,
  ccw: boolean,
): Vec2[] {
  const kS = rStart === 0 || !isFinite(rStart) ? 0 : 1 / rStart;
  const kE = rEnd === 0 || !isFinite(rEnd) ? 0 : 1 / rEnd;
  const sign = ccw ? 1 : -1;
  const n = Math.max(2, Math.round(L / STEP));
  const ds = L / n;
  let th = Math.atan2(pi[1] - a[1], pi[0] - a[0]);
  let x = a[0];
  let y = a[1];
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const k0 = sign * (kS + (kE - kS) * t0);
    const k1 = sign * (kS + (kE - kS) * t1);
    const th1 = th + 0.5 * (k0 + k1) * ds;
    x += 0.5 * (Math.cos(th) + Math.cos(th1)) * ds;
    y += 0.5 * (Math.sin(th) + Math.sin(th1)) * ds;
    th = th1;
    out.push([x, y]);
  }
  return out;
}

/**
 * Importa el primer alignment de un LandXML. Muestrea CoordGeom a polilínea densa
 * y construye el PkMap (staStart + StaEquation). Devuelve null si no hay geometría.
 */
export function parseLandXML(text: string): LandXMLResult | null {
  const root = parseXML(text);
  if (!root) return null;
  const align = findFirst(root, "Alignment");
  if (!align) return null;
  const warnings: string[] = [];
  const name = align.attrs.name || align.attrs.desc || "alignment";
  const staStart = parseFloat(align.attrs.staStart || "0") || 0;

  const geom = findFirst(align, "CoordGeom");
  if (!geom) return null;
  const pts: Vec2[] = [];
  let started = false;
  const pushStart = (p: Vec2 | null) => {
    if (p && !started) {
      pts.push(p);
      started = true;
    }
  };
  for (const el of geom.children) {
    if (el.tag === "Line") {
      const a = pointOf(childrenByTag(el, "Start")[0]);
      const b = pointOf(childrenByTag(el, "End")[0]);
      if (!a || !b) {
        warnings.push("Line sin Start/End válidos: omitida.");
        continue;
      }
      pushStart(a);
      pts.push(...sampleLine(a, b));
    } else if (el.tag === "Curve") {
      const a = pointOf(childrenByTag(el, "Start")[0]);
      const c = pointOf(childrenByTag(el, "Center")[0]);
      const b = pointOf(childrenByTag(el, "End")[0]);
      if (!a || !c || !b) {
        warnings.push("Curve sin Start/Center/End válidos: omitida.");
        continue;
      }
      const ccw = (el.attrs.rot || "ccw").toLowerCase() !== "cw";
      pushStart(a);
      pts.push(...sampleArc(a, c, b, ccw));
    } else if (el.tag === "Spiral") {
      const a = pointOf(childrenByTag(el, "Start")[0]);
      const pi = pointOf(childrenByTag(el, "PI")[0]);
      const b = pointOf(childrenByTag(el, "End")[0]);
      const L = parseFloat(el.attrs.length || "0");
      if (!a || !pi || !b || !(L > 0)) {
        warnings.push("Spiral sin Start/PI/End/length válidos: omitida.");
        continue;
      }
      const rStart = parseFloat(el.attrs.radiusStart || "0");
      const rEnd = parseFloat(el.attrs.radiusEnd || "0");
      const ccw = (el.attrs.rot || "ccw").toLowerCase() !== "cw";
      pushStart(a);
      pts.push(...sampleSpiral(a, pi, L, rStart, rEnd, ccw));
    } else {
      warnings.push(`Elemento CoordGeom no soportado: <${el.tag}> (omitido).`);
    }
  }
  if (pts.length < 2) return null;

  // longitud de arco muestreada (para el PkMap).
  let length = 0;
  for (let i = 1; i < pts.length; i++)
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);

  // PkMap: staStart en s=0 + ecuaciones de PK. staInternal es la estación interna
  // continua (staStart + arco) en la ruptura ⇒ s_eq = staInternal − staStart.
  const pkMap: PkMap = [{ s: 0, pk: staStart }];
  const equations = childrenByTag(align, "StaEquation")
    .map((e) => ({
      staInternal: parseFloat(e.attrs.staInternal || ""),
      staAhead: parseFloat(e.attrs.staAhead || ""),
    }))
    .filter((e) => isFinite(e.staInternal) && isFinite(e.staAhead))
    .sort((p, q) => p.staInternal - q.staInternal);
  for (const eq of equations) {
    const sEq = eq.staInternal - staStart;
    if (sEq > 1e-6 && sEq < length) pkMap.push({ s: sEq, pk: eq.staAhead });
    else warnings.push(`Ecuación de PK fuera de rango (staInternal=${eq.staInternal}): omitida.`);
  }

  return { points: pts, pkMap, staStart, length, name, warnings };
}
