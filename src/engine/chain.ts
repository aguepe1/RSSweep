// CADENA CINEMÁTICA — resolución de posiciones, solver de equilibrio y contornos.
import type {
  ChainSolution,
  ModulePose,
  Poly,
  Track,
  Vec2,
  Vehicle,
  VehicleModule,
  WarmStart,
} from "../types";
import { unit, vadd, vlen, vscale, vsub } from "./vec";
import { syncJoints } from "./vehicle";

/**
 * Resuelve la cadena para el pivote delantero en s1.
 * @param yaws lazo de caja impuesto por módulo bogie (orden de aparición); si
 *   falta, la caja toma la secante local del eje.
 */
export function solveChain(
  track: Track,
  v: Vehicle,
  s1: number,
  yaws?: number[] | null,
  sHints?: number[] | null,
): ChainSolution | null {
  syncJoints(v);
  const wb = v.wheelbase || 1.8;
  const mods = v.modules;
  const poses = new Array<ModulePose>(mods.length);
  const sPivots: number[] = [];
  const pivots: Vec2[] = [];
  const sFronts: number[] = [];
  const secants: number[] = [];
  let bOrder = 0;

  const isGuided = (m: VehicleModule): boolean => m.type === "bogie" || m.type === "biBogie";
  const pivotFrontOf = (m: VehicleModule): number =>
    m.type === "biBogie" ? (m.pivotFrontFromFront ?? 0) : (m.pivotFromFront ?? 0);
  /** Punto medio de la cuerda del empate p centrada en la abscisa s. */
  const chordMid = (s: number, p: number): Vec2 =>
    vscale(vadd(track.pos(s - p / 2), track.pos(s + p / 2)), 0.5);

  function bogiePose(m: VehicleModule, s: number, bIdx: number): ModulePose {
    const mwb = m.wheelbase || wb;
    const p1 = track.pos(s - mwb / 2);
    const p2 = track.pos(s + mwb / 2);
    const sec = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const rigid = m.bogieType === "rigido";
    const th = !rigid && yaws && yaws[bIdx] != null ? yaws[bIdx] : sec;
    const anchor = rigid ? vscale(vadd(p1, p2), 0.5) : track.pos(s);
    const front = vadd(anchor, vscale(unit(th), m.pivotFromFront ?? 0));
    return { front, theta: th, secant: sec, rigid };
  }

  /**
   * Pivote trasero del biBogie: abscisa s_r < s_f tal que la distancia entre los
   * dos centros de bogie (puntos medios de cuerda de empate) valga a. Bisección en
   * dos fases (±0.9 fino / ±4.5 amplio) alrededor de la cuerda s_f−a; devuelve null
   * si no se puede acotar (extremos del trazado). Ver E4-B2 en docs/ENGINE_NOTES.
   */
  function solveRear(sFront: number, p: number, a: number): number | null {
    const Pf = chordMid(sFront, p);
    const fr = (sr: number): number => vlen(vsub(Pf, chordMid(sr, p))) - a;
    const g = sFront - a;
    let lo: number | null = null;
    let hi: number | null = null;
    for (const [half, ds] of [
      [0.9, 0.15],
      [4.5, 0.25],
    ]) {
      let prevS = g - half;
      let prevF = fr(prevS);
      for (let sc = g - half + ds; sc <= g + half + 1e-9; sc += ds) {
        const fc = fr(sc);
        if (prevF * fc <= 0) {
          lo = prevS;
          hi = sc;
          break;
        }
        prevS = sc;
        prevF = fc;
      }
      if (lo !== null) break;
    }
    if (lo === null || hi === null) return null;
    let a0 = lo;
    let b0 = hi;
    let fLo = fr(a0);
    while (b0 - a0 > 1e-8) {
      const mid = 0.5 * (a0 + b0);
      const fm = fr(mid);
      if (fLo * fm <= 0) b0 = mid;
      else {
        a0 = mid;
        fLo = fm;
      }
    }
    return 0.5 * (a0 + b0);
  }

  /**
   * Pose del biBogie con el pivote delantero en sFront: rumbo = cuerda entre los dos
   * pivotes, frente F = P_f + rumbo·pivotFrontFromFront. `sRear` es null si el pivote
   * trasero no se puede resolver (para f(s) se usa la aproximación por cuerda).
   */
  function biBogieResolve(
    m: VehicleModule,
    sFront: number,
  ): { pose: ModulePose; sRear: number | null; srUse: number; Pf: Vec2; Pr: Vec2 } {
    const p = m.wheelbase || wb;
    const a = (m.pivotRearFromFront ?? 0) - (m.pivotFrontFromFront ?? 0);
    const sRear = solveRear(sFront, p, a);
    const srUse = sRear ?? sFront - a;
    const Pf = chordMid(sFront, p);
    const Pr = chordMid(srUse, p);
    const th = Math.atan2(Pf[1] - Pr[1], Pf[0] - Pr[0]);
    const front = vadd(Pf, vscale(unit(th), m.pivotFrontFromFront ?? 0));
    return { pose: { front, theta: th, secant: th, rigid: true }, sRear, srUse, Pf, Pr };
  }

  /** Pose unificada de un módulo guiado (bogie|biBogie) con el pivote delantero en s. */
  function guidedPose(
    m: VehicleModule,
    s: number,
    bIdx: number,
  ): { pose: ModulePose; arcs: number[]; pts: Vec2[]; ok: boolean } {
    if (m.type === "biBogie") {
      const r = biBogieResolve(m, s);
      return {
        pose: r.pose,
        arcs: [s, r.srUse],
        pts: [r.Pf, r.Pr],
        ok: r.sRear !== null && r.srUse >= 0,
      };
    }
    const pose = bogiePose(m, s, bIdx);
    const anchor = pose.rigid ? chordMid(s, m.wheelbase || wb) : track.pos(s);
    return { pose, arcs: [s], pts: [anchor], ok: true };
  }
  function jointFrontPt(m: VehicleModule, pose: ModulePose): Vec2 {
    return vadd(pose.front, vscale(unit(pose.theta), -(m.jointFrontOff || 0)));
  }
  function jointRearPt(m: VehicleModule, pose: ModulePose): Vec2 {
    return vadd(pose.front, vscale(unit(pose.theta), -(m.length - (m.jointRearOff || 0))));
  }

  const g0 = guidedPose(mods[0], s1, bOrder);
  if (!g0.ok) return null;
  poses[0] = g0.pose;
  secants.push(g0.pose.secant!);
  for (const sa of g0.arcs) sPivots.push(sa);
  for (const pt of g0.pts) pivots.push(pt);
  sFronts.push(s1);
  bOrder++;
  let A = jointRearPt(mods[0], poses[0]);
  let sPrev = s1;
  let i = 1;
  while (i < mods.length) {
    while (i < mods.length && v.joints[i - 1] && v.joints[i - 1].type === "rigida") {
      const th = poses[i - 1].theta;
      poses[i] = { front: A, theta: th };
      A = jointRearPt(mods[i], poses[i]);
      i++;
    }
    if (i >= mods.length) break;

    const group: number[] = [];
    while (i < mods.length && !isGuided(mods[i])) group.push(i++);
    if (i >= mods.length) return null;
    const j = i;
    const Lsum = group.reduce((a, gi) => a + mods[gi].length, 0);
    const dPrev = vlen(vsub(track.pos(sPrev), A));
    const chainGuess = dPrev + Lsum + (pivotFrontOf(mods[j]) - (mods[j].jointFrontOff || 0));

    const f = (s: number): number =>
      vlen(vsub(A, jointFrontPt(mods[j], guidedPose(mods[j], s, bOrder).pose))) - Lsum;
    let sj: number;
    const g = sHints && sHints[bOrder] != null ? sHints[bOrder] : sPrev - chainGuess;
    if (Lsum > 1e-9) {
      let lo: number | null = null;
      let hi: number | null = null;
      for (const [half, ds] of [
        [0.9, 0.15],
        [4.5, 0.25],
      ]) {
        let prevS = g - half;
        let prevF = f(prevS);
        for (let sc = g - half + ds; sc <= g + half + 1e-9; sc += ds) {
          const fc = f(sc);
          if (prevF * fc <= 0) {
            lo = prevS;
            hi = sc;
            break;
          }
          prevS = sc;
          prevF = fc;
        }
        if (lo !== null) break;
      }
      if (lo === null || hi === null) return null;
      let a0 = lo;
      let b0 = hi;
      let fLo = f(a0);
      while (b0 - a0 > 1e-8) {
        const mid = 0.5 * (a0 + b0);
        const fm = f(mid);
        if (fLo * fm <= 0) b0 = mid;
        else {
          a0 = mid;
          fLo = fm;
        }
      }
      sj = 0.5 * (a0 + b0);
    } else {
      let lo = g - 2.5;
      let hi = g + 2.5;
      while (hi - lo > 1e-8) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2;
        else lo = m1;
      }
      sj = 0.5 * (lo + hi);
    }
    if (sj < 0 || sj > track.length) return null;
    const gj = guidedPose(mods[j], sj, bOrder);
    if (!gj.ok) return null;
    poses[j] = gj.pose;
    secants.push(gj.pose.secant!);
    for (const sa of gj.arcs) sPivots.push(sa);
    for (const pt of gj.pts) pivots.push(pt);
    sFronts.push(sj);
    bOrder++;
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

  const jointAngles: number[] = [];
  const jointPts: Vec2[] = [];
  for (let k = 0; k < mods.length - 1; k++) {
    let d = poses[k + 1].theta - poses[k].theta;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    jointAngles.push((d * 180) / Math.PI);
    jointPts.push(jointRearPt(mods[k], poses[k]));
  }
  return { poses, sPivots, pivots, sFronts, jointAngles, jointPts, secants };
}

export function hasBisectriz(v: Vehicle): boolean {
  return (v.joints || []).some((j) => j.type === "bisectriz");
}

/** Módulos suspendidos con bielas de centrado (>=1 rótula adyacente bisectriz). */
function centeredModules(v: Vehicle): Array<{ idx: number; k: number }> {
  const out: Array<{ idx: number; k: number }> = [];
  v.modules.forEach((m, i) => {
    if (m.type !== "suspendido") return;
    const jb = v.joints[i - 1];
    const ja = v.joints[i];
    const ks: number[] = [];
    if (jb && jb.type === "bisectriz") ks.push(jb.stiffness || 10);
    if (ja && ja.type === "bisectriz") ks.push(ja.stiffness || 10);
    if (ks.length) out.push({ idx: i, k: Math.max(...ks) });
  });
  return out;
}

/**
 * Solver de equilibrio (bisectriz): libera el lazo de caja de los bogies y
 * minimiza E(ψ) por Newton amortiguado (Levenberg). Warm start entre pasos.
 */
export function solveChainEq(
  track: Track,
  v: Vehicle,
  s1: number,
  warm?: WarmStart | null,
): ChainSolution | null {
  const sHints = warm && warm.sFronts ? warm.sFronts : null;
  if (!hasBisectriz(v)) {
    return solveChain(track, v, s1, null, sHints);
  }
  // Orden guiado (bogie|biBogie); el biBogie es rígido (sin lazo libre) y se excluye
  // de los grados de libertad, como el bogie "rigido". Sin lazos libres ⇒ la
  // geometría queda determinada y el solver de equilibrio no interviene (E4-B2).
  const guided = v.modules.filter((m) => m.type === "bogie" || m.type === "biBogie");
  const nB = guided.length;
  const freeIdx = guided
    .map((m, i) => (m.type === "bogie" && m.bogieType !== "rigido" ? i : -1))
    .filter((i) => i >= 0);
  if (!freeIdx.length) return solveChain(track, v, s1, null, sHints);
  const centered = centeredModules(v);
  function wrapAng(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  let lastChain: ChainSolution | null = null;
  function energy(yaws: number[]): { E: number; ch: ChainSolution } | null {
    const ch = solveChain(track, v, s1, yaws, lastChain ? lastChain.sFronts : sHints);
    if (!ch) return null;
    let Ev = 0;
    for (const b of freeIdx) {
      const d = wrapAng(yaws[b] - ch.secants[b]);
      Ev += d * d;
    }
    for (const c of centered) {
      const th = ch.poses[c.idx].theta;
      const d = wrapAng(ch.poses[c.idx - 1].theta - th) + wrapAng(ch.poses[c.idx + 1].theta - th);
      Ev += c.k * d * d;
    }
    return { E: Ev, ch };
  }

  let yaws: number[];
  if (warm && warm.yaws && warm.yaws.length === nB) yaws = warm.yaws.slice();
  else {
    const base = solveChain(track, v, s1, null, sHints);
    if (!base) return null;
    yaws = base.secants.slice();
  }

  let cur = energy(yaws);
  if (!cur) return null;
  lastChain = cur.ch;
  const h = 3e-4;
  const evalAt = (dy: Record<number, number>): number | null => {
    const y2 = yaws.map((y, i) => y + (dy[i] || 0));
    const r = energy(y2);
    return r ? r.E : null;
  };

  const nF = freeIdx.length;
  for (let iter = 0; iter < 12; iter++) {
    const grad = new Array<number>(nF);
    const H = Array.from({ length: nF }, () => new Array<number>(nF).fill(0));
    let ok = true;
    for (let i = 0; i < nF && ok; i++) {
      const gi = freeIdx[i];
      const dp: Record<number, number> = {};
      const dm: Record<number, number> = {};
      dp[gi] = h;
      dm[gi] = -h;
      const Ep = evalAt(dp);
      const Em = evalAt(dm);
      if (Ep == null || Em == null) {
        ok = false;
        break;
      }
      grad[i] = (Ep - Em) / (2 * h);
      H[i][i] = (Ep - 2 * cur.E + Em) / (h * h);
      for (let j2 = i + 1; j2 < nF; j2++) {
        const gj = freeIdx[j2];
        const dpp: Record<number, number> = {};
        const dpm: Record<number, number> = {};
        const dmp: Record<number, number> = {};
        const dmm: Record<number, number> = {};
        dpp[gi] = h;
        dpp[gj] = h;
        dpm[gi] = h;
        dpm[gj] = -h;
        dmp[gi] = -h;
        dmp[gj] = h;
        dmm[gi] = -h;
        dmm[gj] = -h;
        const a = evalAt(dpp);
        const b = evalAt(dpm);
        const c = evalAt(dmp);
        const d = evalAt(dmm);
        if (a == null || b == null || c == null || d == null) {
          ok = false;
          break;
        }
        H[i][j2] = H[j2][i] = (a - b - c + d) / (4 * h * h);
      }
    }
    if (!ok) break;
    const gNorm = Math.sqrt(grad.reduce((a, g2) => a + g2 * g2, 0));
    if (gNorm < 1e-7) break;
    let lambda = 1e-4;
    let accepted = false;
    for (let t = 0; t < 6 && !accepted; t++) {
      const M = H.map((row, i) => row.map((x, j2) => x + (i === j2 ? lambda : 0)));
      const dx = solveLin(
        M,
        grad.map((g2) => -g2),
      );
      if (dx) {
        const y2 = yaws.slice();
        freeIdx.forEach((gi, i) => {
          y2[gi] = yaws[gi] + Math.max(-0.25, Math.min(0.25, dx[i]));
        });
        const trial = energy(y2);
        if (trial && trial.E < cur.E - 1e-14) {
          yaws = y2;
          cur = trial;
          lastChain = trial.ch;
          accepted = true;
        }
      }
      lambda *= 10;
    }
    if (!accepted) break;
  }
  cur.ch.yaws = yaws;
  return cur.ch;
}

/** Resolución de sistema lineal pequeño (eliminación gaussiana con pivoteo). */
export function solveLin(A: number[][], b: number[]): number[] | null {
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

interface Face {
  c: Vec2;
  nrm: Vec2;
  hw: number;
}

/**
 * Contornos para una solución de cadena. Los testeros articulados se retranquean
 * gap/2 y el fuelle cubre el hueco.
 */
export function footprint(v: Vehicle, chain: ChainSolution): Poly[] {
  syncJoints(v);
  const polys: Poly[] = [];
  const faces: Array<Array<Face | undefined>> = [];
  v.modules.forEach((m, idx) => {
    const p = chain.poses[idx];
    const u = unit(p.theta);
    const nrm = unit(p.theta + Math.PI / 2);
    const hw = m.width / 2;
    const Lm = m.length;
    const F = p.front;
    const jBefore = idx > 0 ? v.joints[idx - 1] : null;
    const jAfter = idx < v.modules.length - 1 ? v.joints[idx] : null;
    const fs = jBefore ? (jBefore.gap || 0) / 2 : 0;
    const rs = jAfter ? (jAfter.gap || 0) / 2 : 0;
    const f0 = vadd(F, vscale(u, -fs));
    const r0 = vadd(F, vscale(u, -(Lm - rs)));
    // El contorno se define en [0, length]; se encaja longitudinalmente en el
    // cuerpo dibujado [fs, length−rs] (retranqueo gap/2 en testeros articulados)
    // para que el rectángulo explícito reproduzca EXACTAMENTE el rectángulo por
    // defecto y el chaflán respete el hueco de fuelle (E2-6).
    const bodyLen = Lm - fs - rs;
    polys.push({
      kind: "body",
      pts: m.contour
        ? m.contour.map(([x, y]) =>
            vadd(vadd(F, vscale(u, -(fs + (x / Lm) * bodyLen))), vscale(nrm, y)),
          )
        : [
            vadd(f0, vscale(nrm, hw)),
            vadd(f0, vscale(nrm, -hw)),
            vadd(r0, vscale(nrm, -hw)),
            vadd(r0, vscale(nrm, hw)),
          ],
    });
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
      const c = m.cabFront
        ? vadd(F, vscale(u, -mir.offsetFromFront))
        : vadd(F, vscale(u, -(Lm - mir.offsetFromFront)));
      for (const side of [1, -1]) {
        const b = vadd(c, vscale(nrm, side * hw));
        polys.push({
          kind: "mirror",
          pts: [
            b,
            vadd(b, vscale(nrm, side * mir.protrusion)),
            vadd(vadd(b, vscale(nrm, side * mir.protrusion)), vscale(u, -mir.length)),
            vadd(b, vscale(u, -mir.length)),
          ],
        });
      }
    }
  });
  faces.forEach((pair) => {
    if (!pair || !pair[0] || !pair[1]) return;
    const a = pair[0];
    const b = pair[1];
    polys.push({
      kind: "fuelle",
      pts: [
        vadd(a.c, vscale(a.nrm, a.hw)),
        vadd(b.c, vscale(b.nrm, b.hw)),
        vadd(b.c, vscale(b.nrm, -b.hw)),
        vadd(a.c, vscale(a.nrm, -a.hw)),
      ],
    });
  });
  return polys;
}
