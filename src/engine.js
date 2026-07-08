// ============================================================================
// ENGINE — sweep analysis para tranvias (puro JS, sin DOM)
// ============================================================================
"use strict";

// ---------------------------------------------------------------- utilidades
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function vscale(a, k) { return [a[0] * k, a[1] * k]; }
function vlen(a) { return Math.hypot(a[0], a[1]); }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function unit(th) { return [Math.cos(th), Math.sin(th)]; }

// ---------------------------------------------------------------- TRACK
// Construccion desde segmentos de curvatura (presets)
function trackFromSegments(segments, ds) {
  ds = ds || 0.02;
  const pieces = [];
  let s0 = 0;
  for (const seg of segments) {
    const [typ, L] = seg;
    if (typ === "straight") pieces.push([s0, s0 + L, 0, 0]);
    else if (typ === "arc") pieces.push([s0, s0 + L, seg[2], seg[2]]);
    else if (typ === "clothoid") pieces.push([s0, s0 + L, seg[2], seg[3]]);
    s0 += L;
  }
  const n = Math.floor(s0 / ds) + 1;
  const s = new Float64Array(n), k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s[i] = Math.min(i * ds, s0);
    for (const [sa, sb, ka, kb] of pieces) {
      if (s[i] >= sa && s[i] <= sb) { k[i] = sb > sa ? ka + (kb - ka) * (s[i] - sa) / (sb - sa) : ka; break; }
    }
  }
  const x = new Float64Array(n), y = new Float64Array(n), th = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dsi = s[i] - s[i - 1];
    th[i] = th[i - 1] + 0.5 * (k[i] + k[i - 1]) * dsi;
    x[i] = x[i - 1] + 0.5 * (Math.cos(th[i]) + Math.cos(th[i - 1])) * dsi;
    y[i] = y[i - 1] + 0.5 * (Math.sin(th[i]) + Math.sin(th[i - 1])) * dsi;
  }
  return makeTrack(s, x, y);
}

// Construccion desde lista de puntos [[x,y],...] (import DXF)
function trackFromPoints(pts) {
  const xs = [pts[0][0]], ys = [pts[0][1]], ss = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d < 1e-9) continue;
    ss.push(ss[ss.length - 1] + d);
    xs.push(pts[i][0]); ys.push(pts[i][1]);
  }
  return makeTrack(Float64Array.from(ss), Float64Array.from(xs), Float64Array.from(ys));
}

function makeTrack(s, x, y) {
  const n = s.length, length = s[n - 1];
  function locate(sv) {
    if (sv <= 0) return 0;
    if (sv >= length) return n - 2;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid] <= sv) lo = mid; else hi = mid; }
    return lo;
  }
  function pos(sv) {
    sv = Math.max(0, Math.min(length, sv));
    const i = locate(sv), t = (sv - s[i]) / (s[i + 1] - s[i]);
    return [x[i] + t * (x[i + 1] - x[i]), y[i] + t * (y[i + 1] - y[i])];
  }
  function heading(sv) {
    const h = 0.25;
    const p1 = pos(sv - h), p2 = pos(sv + h);
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }
  function secantHeading(sv, base) {
    const p1 = pos(sv - base / 2), p2 = pos(sv + base / 2);
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }
  return { s, x, y, n, length, pos, heading, secantHeading };
}

// ---------------------------------------------------------------- DXF IMPORT
// Soporta LINE, ARC, LWPOLYLINE (con bulge), POLYLINE/VERTEX. Ignora el resto.
function parseDXF(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  }
  // localizar seccion ENTITIES
  let i0 = -1;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 2 && pairs[i][1] === "ENTITIES") { i0 = i + 1; break; }
  }
  if (i0 < 0) return { chains: [], warnings: ["No se encontro la seccion ENTITIES en el DXF."] };

  const entities = [];
  const ignored = new Set();
  let i = i0;
  function collect(start) { // devuelve [entidad, indiceSiguiente]
    const typ = pairs[start][1];
    const data = [];
    let j = start + 1;
    while (j < pairs.length && pairs[j][0] !== 0) { data.push(pairs[j]); j++; }
    return [{ typ, data }, j];
  }
  const raw = [];
  while (i < pairs.length) {
    if (pairs[i][0] === 0) {
      if (pairs[i][1] === "ENDSEC") break;
      const [ent, next] = collect(i);
      raw.push(ent); i = next;
    } else i++;
  }
  // agrupar POLYLINE + VERTEX + SEQEND
  for (let r = 0; r < raw.length; r++) {
    const e = raw[r];
    if (e.typ === "POLYLINE") {
      const verts = [];
      let j = r + 1;
      while (j < raw.length && raw[j].typ === "VERTEX") { verts.push(raw[j]); j++; }
      if (j < raw.length && raw[j].typ === "SEQEND") j++;
      entities.push({ typ: "POLYLINE", verts });
      r = j - 1;
    } else if (["LINE", "ARC", "LWPOLYLINE"].includes(e.typ)) {
      entities.push(e);
    } else if (!["SEQEND", "VERTEX"].includes(e.typ)) {
      ignored.add(e.typ);
    }
  }

  function getf(data, code, dflt) {
    for (const [c, v] of data) if (c === code) return parseFloat(v);
    return dflt;
  }
  function bulgeToPoints(p1, p2, bulge, maxStep) {
    // bulge = tan(theta/4); theta = angulo incluido (signo = sentido)
    const theta = 4 * Math.atan(bulge);
    const chord = vlen(vsub(p2, p1));
    if (chord < 1e-9) return [];
    const R = chord / (2 * Math.sin(Math.abs(theta) / 2));
    const mid = vscale(vadd(p1, p2), 0.5);
    const perp = [-(p2[1] - p1[1]) / chord, (p2[0] - p1[0]) / chord];
    const h = R * Math.cos(Math.abs(theta) / 2) * Math.sign(theta);
    const c = vadd(mid, vscale(perp, -h)); // centro: convencion bulge>0 CCW
    const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    const nSeg = Math.max(2, Math.ceil(Math.abs(theta) * R / maxStep));
    const pts = [];
    for (let k = 1; k < nSeg; k++) {
      const a = a1 + theta * k / nSeg;
      pts.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
    }
    return pts;
  }

  const MAXSTEP = 0.05;
  const chains = [];
  for (const e of entities) {
    if (e.typ === "LINE") {
      chains.push([[getf(e.data, 10, 0), getf(e.data, 20, 0)], [getf(e.data, 11, 0), getf(e.data, 21, 0)]]);
    } else if (e.typ === "ARC") {
      const cx = getf(e.data, 10, 0), cy = getf(e.data, 20, 0), R = getf(e.data, 40, 1);
      let a1 = getf(e.data, 50, 0) * Math.PI / 180, a2 = getf(e.data, 51, 0) * Math.PI / 180;
      while (a2 <= a1) a2 += 2 * Math.PI; // DXF ARC siempre CCW
      const nSeg = Math.max(2, Math.ceil((a2 - a1) * R / MAXSTEP));
      const pts = [];
      for (let k = 0; k <= nSeg; k++) {
        const a = a1 + (a2 - a1) * k / nSeg;
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      }
      chains.push(pts);
    } else if (e.typ === "LWPOLYLINE") {
      const verts = []; // {p, bulge}
      let cur = null;
      for (const [c, v] of e.data) {
        if (c === 10) { cur = { p: [parseFloat(v), 0], bulge: 0 }; verts.push(cur); }
        else if (c === 20 && cur) cur.p[1] = parseFloat(v);
        else if (c === 42 && cur) cur.bulge = parseFloat(v);
      }
      const pts = [];
      for (let k = 0; k < verts.length; k++) {
        pts.push(verts[k].p);
        if (k + 1 < verts.length && Math.abs(verts[k].bulge) > 1e-12) {
          pts.push(...bulgeToPoints(verts[k].p, verts[k + 1].p, verts[k].bulge, MAXSTEP));
        }
      }
      if (pts.length >= 2) chains.push(pts);
    } else if (e.typ === "POLYLINE") {
      const pts = [];
      for (let k = 0; k < e.verts.length; k++) {
        const p = [getf(e.verts[k].data, 10, 0), getf(e.verts[k].data, 20, 0)];
        pts.push(p);
        const b = getf(e.verts[k].data, 42, 0);
        if (k + 1 < e.verts.length && Math.abs(b) > 1e-12) {
          const p2 = [getf(e.verts[k + 1].data, 10, 0), getf(e.verts[k + 1].data, 20, 0)];
          pts.push(...bulgeToPoints(p, p2, b, MAXSTEP));
        }
      }
      if (pts.length >= 2) chains.push(pts);
    }
  }
  const warnings = [];
  if (ignored.size) warnings.push("Entidades ignoradas (no soportadas): " + [...ignored].join(", ") +
    ". Convierte splines a polilineas en CAD antes de exportar.");
  return { chains, warnings };
}

// Encadena entidades sueltas en una unica polilinea por proximidad de extremos
function joinChains(chains, tol) {
  tol = tol || 0.05;
  if (chains.length === 0) return { points: null, warnings: ["El DXF no contiene geometria importable."] };
  const pool = chains.map(c => c.slice());
  // empezar por la cadena mas larga
  let bi = 0, bl = -1;
  for (let i = 0; i < pool.length; i++) {
    let L = 0; for (let k = 1; k < pool[i].length; k++) L += vlen(vsub(pool[i][k], pool[i][k - 1]));
    if (L > bl) { bl = L; bi = i; }
  }
  let path = pool.splice(bi, 1)[0];
  let grew = true;
  while (grew && pool.length) {
    grew = false;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const pS = path[0], pE = path[path.length - 1];
      const cS = c[0], cE = c[c.length - 1];
      if (vlen(vsub(pE, cS)) < tol) { path = path.concat(c.slice(1)); pool.splice(i, 1); grew = true; break; }
      if (vlen(vsub(pE, cE)) < tol) { path = path.concat(c.slice(0, -1).reverse()); pool.splice(i, 1); grew = true; break; }
      if (vlen(vsub(pS, cE)) < tol) { path = c.slice(0, -1).concat(path); pool.splice(i, 1); grew = true; break; }
      if (vlen(vsub(pS, cS)) < tol) { path = c.slice(1).reverse().concat(path); pool.splice(i, 1); grew = true; break; }
    }
  }
  const warnings = [];
  if (pool.length) warnings.push(`${pool.length} entidad(es) no conectadas al eje principal — se han descartado.`);
  return { points: path, warnings };
}

// ---------------------------------------------------------------- VEHICULO
// vehicle = { wheelbase, mirror:{...}, modules:[...],
//             joints:[{type:'libre'|'rigida', gap, fuelleWidth, maxAngleDeg}] }
// joints[i] conecta modules[i] con modules[i+1]

function defaultJoint() { return { type: "libre", gap: 0.40, fuelleWidth: 2.00, maxAngleDeg: 45, stiffness: 10 }; }

// Reglas simplificadas de envolvente cinematica (cuasi-estatica).
// NO es una implementacion certificada de EN 15273; cada proyecto debe
// sustituir estos valores por sus reglas de galibo.
function defaultKin() {
  return {
    enabled: false,
    h: 1.60,      // altura de la seccion de calculo sobre carril [m]
    e: 1.50,      // distancia entre circulos de rodadura [m]
    dMax: 0.120,  // peralte maximo [m]
    rFull: 30,    // radio con peralte pleno [m]; D(s)=dMax*min(1, rFull/R)
    stopped: true,// vehiculo parado en curva (exceso = peralte local)
    iMax: 0.100,  // insuficiencia de peralte a vmax [m]
    sigma: 0.25,  // coeficiente de souplesse
    hRoll: 0.70,  // altura del centro de balanceo [m]
    q: 0.035,     // juegos laterales totales (susp.+rueda/carril+desgaste) [m]
    tAlign: 0.020,// tolerancia de alineacion de via [m]
    tCant: 0.015, // tolerancia de peralte [m]
  };
}

// garantiza que joints tenga longitud modules.length-1
function syncJoints(v) {
  if (!Array.isArray(v.joints)) v.joints = [];
  while (v.joints.length < v.modules.length - 1) v.joints.push(defaultJoint());
  v.joints.length = Math.max(0, v.modules.length - 1);
  return v;
}

function validateVehicle(v) {
  syncJoints(v);
  const errs = [];
  if (!v.modules.length) errs.push("Define al menos un modulo.");
  if (v.modules.length && v.modules[0].type !== "bogie") errs.push("El primer modulo debe ser de tipo bogie (pivote guiado).");
  if (v.modules.length && v.modules[v.modules.length - 1].type !== "bogie") errs.push("El ultimo modulo debe ser de tipo bogie.");
  v.modules.forEach((m, i) => {
    if (!(m.length > 0)) errs.push(`Modulo ${i + 1}: longitud invalida.`);
    if (!(m.width > 0)) errs.push(`Modulo ${i + 1}: ancho invalido.`);
    if (m.type === "bogie" && !(m.pivotFromFront >= 0 && m.pivotFromFront <= m.length))
      errs.push(`Modulo ${i + 1}: el pivote debe estar dentro del modulo (0..longitud).`);
  });
  v.joints.forEach((j, i) => {
    if (j.type === "rigida" && v.modules[i + 1] && v.modules[i + 1].type === "bogie")
      errs.push(`Rotula R${i + 1}: una rotula rigida no puede conectar con un modulo bogie aguas abajo (el pivote guiado quedaria sobredeterminado).`);
    if (j.type === "bisectriz" && v.modules[i] && v.modules[i + 1]
        && v.modules[i].type === "bogie" && v.modules[i + 1].type === "bogie")
      errs.push(`Rotula R${i + 1}: la rotula bisectriz (bielas de centrado) requiere un modulo suspendido adyacente.`);
  });
  return errs;
}

function vehicleLength(v) { return v.modules.reduce((a, m) => a + m.length, 0); }

// Resuelve la cadena para el pivote delantero en s1.
// Devuelve {poses, sPivots, jointAngles(deg, con signo), jointPts} o null.
function solveChain(track, v, s1, yaws, sHints) {
  // yaws (opcional): lazo de caja impuesto por modulo bogie (orden de aparicion).
  // Si no se da, la caja toma la secante local del eje (hipotesis Fase 1).
  syncJoints(v);
  const wb = v.wheelbase || 1.8;
  const mods = v.modules;
  const poses = new Array(mods.length);
  const sPivots = [];
  const secants = [];
  let bOrder = 0;

  function bogiePose(m, s, bIdx) {
    const mwb = m.wheelbase || wb;
    const p1 = track.pos(s - mwb / 2), p2 = track.pos(s + mwb / 2);
    const sec = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const rigid = m.bogieType === "rigido";
    const th = (!rigid && yaws && yaws[bIdx] != null) ? yaws[bIdx] : sec;
    // anclaje: eje de via (pivotante) o punto medio de cuerda del empate (rigido)
    const anchor = rigid ? vscale(vadd(p1, p2), 0.5) : track.pos(s);
    const front = vadd(anchor, vscale(unit(th), m.pivotFromFront));
    return { front, theta: th, secant: sec, rigid };
  }
  function jointFrontPt(m, pose) { return vadd(pose.front, vscale(unit(pose.theta), -(m.jointFrontOff || 0))); }
  function jointRearPt(m, pose) { return vadd(pose.front, vscale(unit(pose.theta), -(m.length - (m.jointRearOff || 0)))); }

  poses[0] = bogiePose(mods[0], s1, bOrder);
  secants.push(poses[0].secant); bOrder++;
  sPivots.push(s1);
  let A = jointRearPt(mods[0], poses[0]);
  let sPrev = s1;
  let i = 1;
  while (i < mods.length) {
    // rotulas rigidas: el modulo (suspendido, validado) prolonga el rumbo anterior
    while (i < mods.length && v.joints[i - 1] && v.joints[i - 1].type === "rigida") {
      const th = poses[i - 1].theta;
      poses[i] = { front: A, theta: th };
      A = jointRearPt(mods[i], poses[i]);
      i++;
    }
    if (i >= mods.length) break;

    // grupo de suspendidos (rotulas libres) hasta el siguiente bogie
    const group = [];
    while (i < mods.length && mods[i].type !== "bogie") group.push(i++);
    if (i >= mods.length) return null;
    const j = i;
    const Lsum = group.reduce((a, gi) => a + mods[gi].length, 0);
    // estimacion del pivote siguiente: distancia euclidea desde el pivote previo
    const dPrev = vlen(vsub(track.pos(sPrev), A));
    const chainGuess = dPrev + Lsum + (mods[j].pivotFromFront - (mods[j].jointFrontOff || 0));

    const f = (s) => vlen(vsub(A, jointFrontPt(mods[j], bogiePose(mods[j], s, bOrder)))) - Lsum;
    let sj = null;
    const g = (sHints && sHints[bOrder] != null) ? sHints[bOrder] : sPrev - chainGuess;
    if (Lsum > 1e-9) {
      // bracketing: primero estrecho alrededor de la estimacion, luego amplio
      let lo = null, hi = null;
      for (const [half, ds] of [[0.9, 0.15], [4.5, 0.25]]) {
        let prevS = g - half, prevF = f(prevS);
        for (let sc = g - half + ds; sc <= g + half + 1e-9; sc += ds) {
          const fc = f(sc);
          if (prevF * fc <= 0) { lo = prevS; hi = sc; break; }
          prevS = sc; prevF = fc;
        }
        if (lo !== null) break;
      }
      if (lo === null) return null;
      let fLo = f(lo);
      while (hi - lo > 1e-8) {
        const mid = 0.5 * (lo + hi), fm = f(mid);
        if (fLo * fm <= 0) hi = mid; else { lo = mid; fLo = fm; }
      }
      sj = 0.5 * (lo + hi);
    } else {
      let lo = g - 2.5, hi = g + 2.5;
      while (hi - lo > 1e-8) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1;
      }
      sj = 0.5 * (lo + hi);
    }
    if (sj < 0 || sj > track.length) return null;
    poses[j] = bogiePose(mods[j], sj, bOrder);
    secants.push(poses[j].secant); bOrder++;
    sPivots.push(sj);
    const B = jointFrontPt(mods[j], poses[j]);
    if (group.length) {
      const dAB = vsub(A, B);
      const th = Math.atan2(dAB[1], dAB[0]);
      let cursor = A;
      for (const gi of group) {
        poses[gi] = { front: cursor, theta: th };
        cursor = vadd(cursor, vscale(unit(th), -mods[gi].length));
      }
    }
    A = jointRearPt(mods[j], poses[j]);
    sPrev = sj;
    i = j + 1;
  }

  // angulos de giro y posiciones de cada rotula
  const jointAngles = [], jointPts = [];
  for (let k = 0; k < mods.length - 1; k++) {
    let d = poses[k + 1].theta - poses[k].theta;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    jointAngles.push(d * 180 / Math.PI);
    jointPts.push(jointRearPt(mods[k], poses[k]));
  }
  return { poses, sPivots, jointAngles, jointPts, secants };
}

// ---------------------------------------------------------------------------
// Solver de equilibrio (Fase 3): libera el lazo de caja de los modulos bogie
// y resuelve el equilibrio cuasi-estatico de muelles de guiado:
//   - muelle caja<->bogie: k_b=1, lleva la caja hacia la secante de via
//   - bielas de centrado (rotula bisectriz): muelle sobre el desequilibrio
//     angular del modulo suspendido: (th_prev + th_next - 2*th_susp)
// Minimizacion por descenso coordenado con Newton 1D (warm start entre pasos).
// ---------------------------------------------------------------------------
function hasBisectriz(v) { return (v.joints || []).some(j => j.type === "bisectriz"); }

// modulos suspendidos con bielas de centrado (>=1 rotula adyacente bisectriz)
function centeredModules(v) {
  const out = [];
  v.modules.forEach((m, i) => {
    if (m.type === "bogie") return;
    const jb = v.joints[i - 1], ja = v.joints[i];
    const ks = [];
    if (jb && jb.type === "bisectriz") ks.push(jb.stiffness || 10);
    if (ja && ja.type === "bisectriz") ks.push(ja.stiffness || 10);
    if (ks.length) out.push({ idx: i, k: Math.max(...ks) });
  });
  return out;
}

function solveChainEq(track, v, s1, warm) {
  // warm (opcional): {yaws, sPivots} del paso anterior para arranque en caliente
  const sHints = warm && warm.sPivots ? warm.sPivots : null;
  if (!hasBisectriz(v)) {
    const ch = solveChain(track, v, s1, null, sHints);
    return ch;
  }
  const bogies = v.modules.filter(m => m.type === "bogie");
  const nB = bogies.length;
  const freeIdx = bogies.map((m, i) => m.bogieType !== "rigido" ? i : -1).filter(i => i >= 0);
  if (!freeIdx.length) return solveChain(track, v, s1, null, sHints); // todo rigido: nada que equilibrar
  const centered = centeredModules(v);
  function wrapAng(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  let lastChain = null;
  function energy(yaws) {
    const ch = solveChain(track, v, s1, yaws, lastChain ? lastChain.sPivots : sHints);
    if (!ch) return null;
    let Ev = 0;
    for (const b of freeIdx) { const d = wrapAng(yaws[b] - ch.secants[b]); Ev += d * d; }
    for (const c of centered) {
      const th = ch.poses[c.idx].theta;
      const d = wrapAng(ch.poses[c.idx - 1].theta - th) + wrapAng(ch.poses[c.idx + 1].theta - th);
      Ev += c.k * d * d;
    }
    return { E: Ev, ch };
  }

  let yaws;
  if (warm && warm.yaws && warm.yaws.length === nB) yaws = warm.yaws.slice();
  else { const base = solveChain(track, v, s1, null, sHints); if (!base) return null; yaws = base.secants.slice(); }

  let cur = energy(yaws);
  if (!cur) return null;
  lastChain = cur.ch;
  const h = 3e-4;
  const evalAt = (dy) => { const y2 = yaws.map((y, i) => y + (dy[i] || 0)); const r = energy(y2); return r ? r.E : null; };

  const nF = freeIdx.length;
  for (let iter = 0; iter < 12; iter++) {
    // gradiente y hessiana por diferencias finitas (solo lazos libres)
    const grad = new Array(nF), H = Array.from({ length: nF }, () => new Array(nF).fill(0));
    let ok = true;
    for (let i = 0; i < nF && ok; i++) {
      const gi = freeIdx[i];
      const dp = {}, dm = {};
      dp[gi] = h; dm[gi] = -h;
      const Ep = evalAt(dp), Em = evalAt(dm);
      if (Ep == null || Em == null) { ok = false; break; }
      grad[i] = (Ep - Em) / (2 * h);
      H[i][i] = (Ep - 2 * cur.E + Em) / (h * h);
      for (let j2 = i + 1; j2 < nF; j2++) {
        const gj = freeIdx[j2];
        const dpp = {}, dpm = {}, dmp = {}, dmm = {};
        dpp[gi] = h; dpp[gj] = h; dpm[gi] = h; dpm[gj] = -h;
        dmp[gi] = -h; dmp[gj] = h; dmm[gi] = -h; dmm[gj] = -h;
        const a = evalAt(dpp), b = evalAt(dpm), c = evalAt(dmp), d = evalAt(dmm);
        if (a == null || b == null || c == null || d == null) { ok = false; break; }
        H[i][j2] = H[j2][i] = (a - b - c + d) / (4 * h * h);
      }
    }
    if (!ok) break;
    const gNorm = Math.sqrt(grad.reduce((a, g2) => a + g2 * g2, 0));
    if (gNorm < 1e-7) break;
    // Newton amortiguado (Levenberg): (H + lambda I) dx = -grad
    let lambda = 1e-4, accepted = false;
    for (let t = 0; t < 6 && !accepted; t++) {
      const M = H.map((row, i) => row.map((x, j2) => x + (i === j2 ? lambda : 0)));
      const dx = solveLin(M, grad.map(g2 => -g2));
      if (dx) {
        const y2 = yaws.slice();
        freeIdx.forEach((gi, i) => { y2[gi] = yaws[gi] + Math.max(-0.25, Math.min(0.25, dx[i])); });
        const trial = energy(y2);
        if (trial && trial.E < cur.E - 1e-14) {
          yaws = y2; cur = trial; lastChain = trial.ch; accepted = true;
        }
      }
      lambda *= 10;
    }
    if (!accepted) break;
  }
  cur.ch.yaws = yaws;
  return cur.ch;
}

// resolucion de sistema lineal pequeño (eliminacion gaussiana con pivoteo)
function solveLin(A, b) {
  const n = b.length;
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// Contornos para una solucion de cadena.
// Devuelve lista de {pts, kind:'body'|'fuelle'|'mirror'}.
// Los testeros articulados se retranquean gap/2 y el fuelle cubre el hueco.
function footprint(v, chain) {
  syncJoints(v);
  const polys = [];
  const faces = []; // caras de testero por rotula: [{c, nrm, hwF}] x2
  v.modules.forEach((m, idx) => {
    const p = chain.poses[idx];
    const u = unit(p.theta), nrm = unit(p.theta + Math.PI / 2);
    const hw = m.width / 2, L = m.length, F = p.front;
    const jBefore = idx > 0 ? v.joints[idx - 1] : null;       // rotula en el frente
    const jAfter = idx < v.modules.length - 1 ? v.joints[idx] : null; // rotula en el testero trasero
    const fs = jBefore ? (jBefore.gap || 0) / 2 : 0;
    const rs = jAfter ? (jAfter.gap || 0) / 2 : 0;
    const f0 = vadd(F, vscale(u, -fs));            // cara delantera (retranqueada)
    const r0 = vadd(F, vscale(u, -(L - rs)));      // cara trasera (retranqueada)
    polys.push({ kind: "body", pts: [
      vadd(f0, vscale(nrm, hw)), vadd(f0, vscale(nrm, -hw)),
      vadd(r0, vscale(nrm, -hw)), vadd(r0, vscale(nrm, hw)),
    ]});
    if (jBefore) {
      if (!faces[idx - 1]) faces[idx - 1] = [];
      faces[idx - 1][1] = { c: f0, nrm, hw: (jBefore.fuelleWidth || m.width) / 2 };
    }
    if (jAfter) {
      if (!faces[idx]) faces[idx] = [];
      faces[idx][0] = { c: r0, nrm, hw: (jAfter.fuelleWidth || m.width) / 2 };
    }
    const mir = v.mirror;
    if (mir && mir.enabled && (m.cabFront || m.cabRear)) {
      const c = m.cabFront ? vadd(F, vscale(u, -mir.offsetFromFront))
                           : vadd(F, vscale(u, -(L - mir.offsetFromFront)));
      for (const side of [1, -1]) {
        const b = vadd(c, vscale(nrm, side * hw));
        polys.push({ kind: "mirror", pts: [b, vadd(b, vscale(nrm, side * mir.protrusion)),
          vadd(vadd(b, vscale(nrm, side * mir.protrusion)), vscale(u, -mir.length)),
          vadd(b, vscale(u, -mir.length))]});
      }
    }
  });
  // fuelles: cuadrilatero entre las dos caras de testero de cada rotula
  faces.forEach((pair) => {
    if (!pair || !pair[0] || !pair[1]) return;
    const [a, b] = pair;
    polys.push({ kind: "fuelle", pts: [
      vadd(a.c, vscale(a.nrm, a.hw)), vadd(b.c, vscale(b.nrm, b.hw)),
      vadd(b.c, vscale(b.nrm, -b.hw)), vadd(a.c, vscale(a.nrm, -a.hw)),
    ]});
  });
  return polys;
}

// ---------------------------------------------------------------- BARRIDO
function runSweep(track, v, opts) {
  opts = opts || {};
  const step = opts.step || 0.25;          // paso de simulacion en s1
  const dst = opts.stationStep || 0.25;    // paso de estaciones para el perfil
  const edgeStep = opts.edgeStep || 0.30;  // muestreo de contornos

  const vlenTotal = vehicleLength(v);
  const sStart = opts.sStart != null ? opts.sStart : vlenTotal + 1.0;
  const sEnd = opts.sEnd != null ? opts.sEnd : track.length - 1.0;
  if (sEnd <= sStart) return { error: "El trazado es demasiado corto para este vehiculo." };

  // estaciones y normales
  const nSt = Math.floor(track.length / dst) + 1;
  const stS = new Float64Array(nSt), stX = new Float64Array(nSt), stY = new Float64Array(nSt),
        stNx = new Float64Array(nSt), stNy = new Float64Array(nSt);
  for (let k = 0; k < nSt; k++) {
    const sv = Math.min(k * dst, track.length);
    stS[k] = sv;
    const p = track.pos(sv), th = track.heading(sv);
    stX[k] = p[0]; stY[k] = p[1];
    stNx[k] = Math.cos(th + Math.PI / 2); stNy[k] = Math.sin(th + Math.PI / 2);
  }
  const left = new Float64Array(nSt).fill(-1e9);
  const right = new Float64Array(nSt).fill(1e9);

  const nJoints = Math.max(0, v.modules.length - 1);
  const jointMax = new Array(nJoints).fill(0);       // |angulo| maximo por rotula
  const jointMaxPk = new Array(nJoints).fill(0);     // PK del maximo

  const steps = [];
  let warm = null;
  for (let s1 = sStart; s1 <= sEnd + 1e-9; s1 += step) {
    const chain = solveChainEq(track, v, s1, warm);
    if (!chain) { warm = null; continue; }
    warm = { yaws: chain.yaws || null, sPivots: chain.sPivots };
    const polys = footprint(v, chain);
    steps.push({ s1, chain, polys });
    chain.jointAngles.forEach((a, k) => {
      if (Math.abs(a) > jointMax[k]) { jointMax[k] = Math.abs(a); jointMaxPk[k] = s1; }
    });
    // ventana de estaciones
    const kLo = Math.max(0, Math.floor((s1 - vlenTotal - 6) / dst));
    const kHi = Math.min(nSt - 1, Math.ceil((s1 + 6) / dst));
    for (const poly of polys) {
      const pts = poly.pts;
      for (let e = 0; e < pts.length; e++) {
        const a = pts[e], b = pts[(e + 1) % pts.length];
        const segLen = vlen(vsub(b, a));
        const nSmp = Math.max(1, Math.ceil(segLen / edgeStep));
        for (let q = 0; q <= nSmp; q++) {
          const px = a[0] + (b[0] - a[0]) * q / nSmp, py = a[1] + (b[1] - a[1]) * q / nSmp;
          let best = -1, bd = 1e18;
          for (let k = kLo; k <= kHi; k++) {
            const dx = px - stX[k], dy = py - stY[k];
            const d2 = dx * dx + dy * dy;
            if (d2 < bd) { bd = d2; best = k; }
          }
          if (best >= 0) {
            const off = (px - stX[best]) * stNx[best] + (py - stY[best]) * stNy[best];
            if (off > left[best]) left[best] = off;
            if (off < right[best]) right[best] = off;
          }
        }
      }
    }
  }
  if (!steps.length) return { error: "No se pudo resolver la cadena cinematica en ningun punto del trazado. Revisa radios minimos vs. geometria del vehiculo." };

  // envolvente cinematica: sobreanchos por estacion y lado (reglas simplificadas)
  const kin = opts.kin && opts.kin.enabled ? opts.kin : null;
  const kinAdd = new Float64Array(2 * nSt); // [izq, dcha] por estacion
  if (kin) {
    const e = kin.e || 1.5, hh = kin.h || 1.6;
    const both = (kin.q || 0) + (kin.tAlign || 0) + hh * (kin.tCant || 0) / e;
    for (let k = 0; k < nSt; k++) {
      const dh = 1.0;
      let dth = track.heading(Math.min(track.length, stS[k] + dh)) - track.heading(Math.max(0, stS[k] - dh));
      while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      const kv = dth / (2 * dh); // curvatura local (>0 = curva a izquierda)
      const c = Math.min(1, Math.abs(kv) * (kin.rFull || 30)); // grado de peralte aplicado
      const D = (kin.cantTable && kin.cantTable.length)
        ? Math.abs(interpTable(kin.cantTable, stS[k]))          // peralte real por fichero [m]
        : (kin.dMax || 0) * c;                                  // ley por curvatura [m]
      const Eexc = kin.stopped ? D : 0;                         // exceso (vehiculo parado)
      const Ins = (kin.iMax || 0) * c;                          // insuficiencia a vmax
      const lever = Math.max(0, hh - (kin.hRoll || 0));
      const inside = Math.max(0, hh * D / e + (kin.sigma || 0) * (Eexc / e) * lever) + both;
      const outside = Math.max(0, (kin.sigma || 0) * (Ins / e) * lever - hh * D / e) + both;
      const isLeftInside = kv > 1e-6, isRightInside = kv < -1e-6;
      kinAdd[2 * k] = isLeftInside ? inside : (isRightInside ? outside : both);       // izq
      kinAdd[2 * k + 1] = isRightInside ? inside : (isLeftInside ? outside : both);   // dcha
    }
  }

  // recortar estaciones sin datos · fila: [s, dchaGeo, izqGeo, kIdx, dchaKin, izqKin]
  const rows = [];
  for (let k = 0; k < nSt; k++) if (left[k] > -1e8 && right[k] < 1e8)
    rows.push([stS[k], right[k], left[k], k,
      right[k] - (kin ? kinAdd[2 * k + 1] : 0), left[k] + (kin ? kinAdd[2 * k] : 0)]);

  let maxL = -1e9, maxR = 1e9, sMaxL = 0, sMaxR = 0, maxLK = -1e9, maxRK = 1e9;
  for (const [sv, r, l, , rk, lk] of rows) {
    if (l > maxL) { maxL = l; sMaxL = sv; }
    if (r < maxR) { maxR = r; sMaxR = sv; }
    if (lk > maxLK) maxLK = lk;
    if (rk < maxRK) maxRK = rk;
  }
  const bodyHW = Math.max(...v.modules.map(m => m.width)) / 2;
  const joints = v.joints.map((j, k) => ({
    idx: k,
    label: `${v.modules[k].id || "M" + (k + 1)}↔${v.modules[k + 1].id || "M" + (k + 2)}`,
    type: j.type, maxAngle: jointMax[k], pk: jointMaxPk[k],
    limit: j.maxAngleDeg, exceeded: j.maxAngleDeg > 0 && jointMax[k] > j.maxAngleDeg,
  }));
  return {
    steps, rows, stations: { stS, stX, stY, stNx, stNy },
    joints,
    summary: {
      bodyHalfWidth: bodyHW,
      maxLeft: maxL, sMaxLeft: sMaxL,
      maxRight: -maxR, sMaxRight: sMaxR,
      totalWidth: maxL - maxR,
      kinEnabled: !!kin,
      kinMaxLeft: maxLK, kinMaxRight: -maxRK,
      kinTotalWidth: maxLK - maxRK,
      nSteps: steps.length,
    },
  };
}

// ---------------------------------------------------------------- OBSTACULOS
// Importa un DXF de obstaculos/clearance lines: TODAS las cadenas se conservan
// (no se encadenan): borde de anden, postes de catenaria, fachadas, mobiliario...
function obstaclesFromDXF(text) {
  const { chains, warnings } = parseDXF(text);
  return { obstacles: chains, warnings };
}

// Comprueba margenes entre la envolvente barrida y los obstaculos.
// margen > 0: holgura · margen < 0: invasion de la envolvente.
// Usa la envolvente cinematica si esta activa; si no, la geometrica.
function clashCheck(track, sweep, obstacles, requiredMargin, sampleStep) {
  requiredMargin = requiredMargin == null ? 0.05 : requiredMargin;
  sampleStep = sampleStep || 0.15;
  const st = sweep.stations, kinOn = sweep.summary.kinEnabled;
  // estaciones con datos de envolvente
  const rows = sweep.rows;
  const pts = [];
  for (const chain of obstacles) {
    for (let e = 0; e + 1 < chain.length; e++) {
      const a = chain[e], b = chain[e + 1];
      const segLen = vlen(vsub(b, a));
      const nSmp = Math.max(1, Math.ceil(segLen / sampleStep));
      for (let q = 0; q <= nSmp; q++) {
        if (e > 0 && q === 0) continue; // no duplicar vertices
        pts.push([a[0] + (b[0] - a[0]) * q / nSmp, a[1] + (b[1] - a[1]) * q / nSmp]);
      }
    }
    if (chain.length === 1) pts.push(chain[0]);
  }
  const results = [];
  let minMargin = Infinity, minAt = null;
  for (const p of pts) {
    // estacion (con envolvente) mas cercana
    let best = -1, bd = 1e18;
    for (let r = 0; r < rows.length; r++) {
      const k = rows[r][3];
      const dx = p[0] - st.stX[k], dy = p[1] - st.stY[k];
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = r; }
    }
    if (best < 0 || bd > 36) continue; // a mas de 6 m del eje: irrelevante
    const row = rows[best], k = row[3];
    const off = (p[0] - st.stX[k]) * stationNx(st, k) + (p[1] - st.stY[k]) * stationNy(st, k);
    const envL = kinOn ? row[5] : row[2];
    const envR = kinOn ? row[4] : row[1];
    const margin = off >= 0 ? off - envL : envR - off;
    const rec = { x: p[0], y: p[1], pk: row[0], off, margin, viol: margin < requiredMargin };
    results.push(rec);
    if (margin < minMargin) { minMargin = margin; minAt = rec; }
  }
  const violations = results.filter(r => r.viol).sort((a, b) => a.margin - b.margin);
  return { points: results, violations, minMargin: isFinite(minMargin) ? minMargin : null,
           minAt, requiredMargin, envelope: kinOn ? "cinematica" : "geometrica" };
}
function stationNx(st, k) { return st.stNx[k]; }
function stationNy(st, k) { return st.stNy[k]; }

// ------------------------------------------------- UIC 505-1 (comparacion)
// Salientes geometricos clasicos del vehiculo equivalente de DOS PIVOTES:
//   interior (seccion media):  dgi_max = a^2/(8R) + p^2/(8R)
//   exterior (voladizo n_a):   dga = (a*n_a + n_a^2)/(2R) - p^2/(8R)
// donde a = empattement entre pivotes, p = empate de bogie, n_a = voladizo.
// NOTA: UIC 505-1/EN 15273 se aplican a ferrocarril convencional (tranvias
// excluidos) y ASUMEN CUERPO RIGIDO entre pivotes: en material articulado
// sobreestiman el interior. Se usan aqui como referencia analitica clasica,
// comparadas contra la huella GEOMETRICA simulada (sin terminos cuasi-estaticos).
function uicParamsFromVehicle(v) {
  // vehiculo equivalente: peor pareja de pivotes consecutivos + peor voladizo
  const mods = v.modules;
  let pos = 0; const pivots = [];
  for (const m of mods) {
    if (m.type === "bogie") pivots.push(pos + m.pivotFromFront);
    pos += m.length;
  }
  const total = pos;
  let a = 0;
  for (let i = 1; i < pivots.length; i++) a = Math.max(a, pivots[i] - pivots[i - 1]);
  const na = Math.max(pivots.length ? pivots[0] : 0, pivots.length ? total - pivots[pivots.length - 1] : 0);
  const b = Math.max(...mods.map(m => m.width)) / 2;
  return { a: +a.toFixed(3), na: +na.toFixed(3), p: v.wheelbase || 1.8, b: +b.toFixed(3) };
}

// perfil analitico por estacion: devuelve mapa rowIdx -> [dcha, izq]
function uic505Profile(track, params, rows, stations) {
  const { a, na, p, b } = params;
  const out = [];
  for (const row of rows) {
    const s = row[0];
    const dh = 1.0;
    let dth = track.heading(Math.min(track.length, s + dh)) - track.heading(Math.max(0, s - dh));
    while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
    const kv = dth / (2 * dh);
    const absk = Math.abs(kv);
    const dgi = (a * a / 8 + p * p / 8) * absk;
    const dga = Math.max(0, (a * na + na * na) / 2 * absk - (p * p / 8) * absk);
    const inner = b + dgi, outer = b + dga;
    if (kv > 1e-6) out.push([-outer, inner]);        // curva a izq: interior = izq
    else if (kv < -1e-6) out.push([-inner, outer]);  // curva a dcha
    else out.push([-b, b]);
  }
  return out;
}

// ---------------------------------------------------------------- PERALTE CSV
// Formato: lineas "pk;peralte_mm" (tambien acepta coma o tab). Devuelve tabla [[pk, D_m]].
function parseCantCSV(text) {
  const table = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const m = line.trim().split(/[;,\t]+/);
    if (m.length < 2) continue;
    const pk = parseFloat(m[0]), d = parseFloat(m[1]);
    if (isFinite(pk) && isFinite(d)) table.push([pk, d / 1000]);
  }
  table.sort((a, b) => a[0] - b[0]);
  return table.length >= 2 ? table : null;
}
function interpTable(table, s) {
  if (s <= table[0][0]) return table[0][1];
  if (s >= table[table.length - 1][0]) return table[table.length - 1][1];
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid][0] <= s) lo = mid; else hi = mid; }
  const t = (s - table[lo][0]) / (table[hi][0] - table[lo][0]);
  return table[lo][1] + t * (table[hi][1] - table[lo][1]);
}

// ---------------------------------------------------------------- DXF EXPORT
// Formato R12 (POLYLINE/VERTEX/SEQEND): compatible con AutoCAD, ezdxf, QGIS...
function writeDXF(track, sweep) {
  const L = [];
  const P = (c, v) => { L.push(String(c)); L.push(String(v)); };
  P(0, "SECTION"); P(2, "HEADER"); P(9, "$ACADVER"); P(1, "AC1009"); P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "TABLES");
  P(0, "TABLE"); P(2, "LAYER"); P(70, 3);
  for (const [name, color] of [["EJE_VIA", 3], ["HUELLA_IZQ", 1], ["HUELLA_DCHA", 1],
                                ["ENVOLVENTE_KIN_IZQ", 2], ["ENVOLVENTE_KIN_DCHA", 2]]) {
    P(0, "LAYER"); P(2, name); P(70, 0); P(62, color); P(6, "CONTINUOUS");
  }
  P(0, "ENDTAB"); P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "ENTITIES");
  function poly(pts, layer) {
    P(0, "POLYLINE"); P(8, layer); P(66, 1); P(70, 0);
    for (const [x, y] of pts) {
      P(0, "VERTEX"); P(8, layer); P(10, x.toFixed(4)); P(20, y.toFixed(4)); P(30, "0.0");
    }
    P(0, "SEQEND"); P(8, layer);
  }
  // eje
  const cl = [];
  for (let sv = 0; sv <= track.length; sv += 0.25) cl.push(track.pos(sv));
  poly(cl, "EJE_VIA");
  // bordes de huella (por estaciones)
  const lb = [], rb = [], lk = [], rk = [];
  const st = sweep.stations;
  for (const [sv, r, l, k, rkin, lkin] of sweep.rows) {
    lb.push([st.stX[k] + l * st.stNx[k], st.stY[k] + l * st.stNy[k]]);
    rb.push([st.stX[k] + r * st.stNx[k], st.stY[k] + r * st.stNy[k]]);
    if (sweep.summary.kinEnabled) {
      lk.push([st.stX[k] + lkin * st.stNx[k], st.stY[k] + lkin * st.stNy[k]]);
      rk.push([st.stX[k] + rkin * st.stNx[k], st.stY[k] + rkin * st.stNy[k]]);
    }
  }
  poly(lb, "HUELLA_IZQ"); poly(rb, "HUELLA_DCHA");
  if (lk.length) { poly(lk, "ENVOLVENTE_KIN_IZQ"); poly(rk, "ENVOLVENTE_KIN_DCHA"); }
  P(0, "ENDSEC"); P(0, "EOF");
  return L.join("\n");
}

// ---------------------------------------------------------------- PRESETS
const TRACK_PRESETS = [
  { id: "r25", name: "1 · Curva R25 + clotoides (90°)", build: () => trackFromSegments([
    ["straight", 20], ["clothoid", 10, 0, 1 / 25], ["arc", 25 * Math.PI / 2, 1 / 25],
    ["clothoid", 10, 1 / 25, 0], ["straight", 20]]) },
  { id: "loop", name: "2 · Bucle terminal R20 (250°)", build: () => trackFromSegments([
    ["straight", 30], ["clothoid", 8, 0, 1 / 20], ["arc", 20 * 250 * Math.PI / 180, 1 / 20],
    ["clothoid", 8, 1 / 20, 0], ["straight", 30]]) },
  { id: "scurve", name: "3 · Contracurva en S (R30/R−30)", build: () => trackFromSegments([
    ["straight", 15], ["clothoid", 8, 0, 1 / 30], ["arc", 30 * Math.PI / 3, 1 / 30],
    ["clothoid", 8, 1 / 30, 0], ["straight", 6], ["clothoid", 8, 0, -1 / 30],
    ["arc", 30 * Math.PI / 3, -1 / 30], ["clothoid", 8, -1 / 30, 0], ["straight", 15]]) },
  { id: "chicane", name: "4 · Chicane R50 sin transiciones", build: () => trackFromSegments([
    ["straight", 20], ["arc", 50 * 14 * Math.PI / 180, 1 / 50],
    ["arc", 50 * 14 * Math.PI / 180, -1 / 50], ["straight", 20]]) },
  { id: "r100", name: "5 · Curva amplia R100 (45°)", build: () => trackFromSegments([
    ["straight", 30], ["clothoid", 20, 0, 1 / 100], ["arc", 100 * Math.PI / 4, 1 / 100],
    ["clothoid", 20, 1 / 100, 0], ["straight", 30]]) },
];

const VEHICLE_PRESETS = [
  {
    id: "urbos5", name: "5 módulos ~32 m (tipo Urbos 3 / Citadis 302)",
    vehicle: { wheelbase: 1.85, mirror: { enabled: true, protrusion: 0.25, length: 0.30, offsetFromFront: 0.55 },
      modules: [
        { id: "C1", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 2.30, jointFrontOff: 0, jointRearOff: 0, cabFront: true },
        { id: "S2", type: "suspendido", length: 6.15, width: 2.65 },
        { id: "C3", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 3.35, jointFrontOff: 0, jointRearOff: 0 },
        { id: "S4", type: "suspendido", length: 6.15, width: 2.65 },
        { id: "C5", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 4.40, jointFrontOff: 0, jointRearOff: 0, cabRear: true },
      ],
      joints: [defaultJoint(), defaultJoint(), defaultJoint(), defaultJoint()] },
  },
  {
    id: "tram3", name: "3 módulos ~24 m (bogie–susp.–bogie)",
    vehicle: { wheelbase: 1.80, mirror: { enabled: true, protrusion: 0.25, length: 0.30, offsetFromFront: 0.55 },
      modules: [
        { id: "C1", type: "bogie", length: 9.20, width: 2.40, pivotFromFront: 2.50, jointFrontOff: 0, jointRearOff: 0, cabFront: true },
        { id: "S2", type: "suspendido", length: 5.60, width: 2.40 },
        { id: "C3", type: "bogie", length: 9.20, width: 2.40, pivotFromFront: 6.70, jointFrontOff: 0, jointRearOff: 0, cabRear: true },
      ],
      joints: [defaultJoint(), defaultJoint()] },
  },
  {
    id: "tram7", name: "7 módulos ~43 m (tipo Urbos XL)",
    vehicle: { wheelbase: 1.85, mirror: { enabled: true, protrusion: 0.25, length: 0.30, offsetFromFront: 0.55 },
      modules: [
        { id: "C1", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 2.30, jointFrontOff: 0, jointRearOff: 0, cabFront: true },
        { id: "S2", type: "suspendido", length: 5.30, width: 2.65 },
        { id: "C3", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 3.35, jointFrontOff: 0, jointRearOff: 0 },
        { id: "S4", type: "suspendido", length: 5.30, width: 2.65 },
        { id: "C5", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 3.35, jointFrontOff: 0, jointRearOff: 0 },
        { id: "S6", type: "suspendido", length: 5.30, width: 2.65 },
        { id: "C7", type: "bogie", length: 6.70, width: 2.65, pivotFromFront: 4.40, jointFrontOff: 0, jointRearOff: 0, cabRear: true },
      ],
      joints: [defaultJoint(), defaultJoint(), defaultJoint(), defaultJoint(), defaultJoint(), defaultJoint()] },
  },
];

if (typeof module !== "undefined") {
  module.exports = { trackFromSegments, trackFromPoints, parseDXF, joinChains, validateVehicle, syncJoints, defaultJoint, defaultKin, solveChainEq, hasBisectriz, obstaclesFromDXF, clashCheck, parseCantCSV, interpTable, uicParamsFromVehicle, uic505Profile,
    vehicleLength, solveChain, footprint, runSweep, writeDXF, TRACK_PRESETS, VEHICLE_PRESETS };
}
