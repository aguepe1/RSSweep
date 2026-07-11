// BARRIDO — envolvente exacta por unión booleana + envolvente cinemática.
import type {
  JointResult,
  ProfileRow,
  Stations,
  SweepOpts,
  SweepResult,
  SweepStep,
  Track,
  Vehicle,
  WarmStart,
} from "../types";
import { footprint, solveChainEq } from "./chain";
import { envelopeRibbon, remapStations } from "./envelope";
import { kinStationAdd } from "./kinematic";
import { reverseTrack } from "./track";
import { vehicleLength } from "./vehicle";

/** Resuelve la cadena a lo largo de `track` en [sStart,sEnd] y devuelve las huellas
 *  (coordenadas absolutas de plano) más el máximo por rótula. `progress` mapea el
 *  avance local [0,1] al rango global de la barra. */
function solveSteps(
  track: Track,
  v: Vehicle,
  sStart: number,
  sEnd: number,
  step: number,
  nJoints: number,
  progress?: (frac: number) => void,
): { steps: SweepStep[]; jointMax: number[]; jointMaxPk: number[] } {
  const steps: SweepStep[] = [];
  const jointMax = new Array<number>(nJoints).fill(0);
  const jointMaxPk = new Array<number>(nJoints).fill(0);
  let warm: WarmStart | null = null;
  const sSpan = sEnd - sStart || 1;
  for (let s1 = sStart; s1 <= sEnd + 1e-9; s1 += step) {
    if (progress) progress(Math.min(1, (s1 - sStart) / sSpan));
    const chain = solveChainEq(track, v, s1, warm);
    if (!chain) {
      warm = null;
      continue;
    }
    warm = { yaws: chain.yaws || null, sFronts: chain.sFronts };
    const polys = footprint(v, chain);
    steps.push({ s1, chain, polys });
    chain.jointAngles.forEach((a, k) => {
      if (Math.abs(a) > jointMax[k]) {
        jointMax[k] = Math.abs(a);
        jointMaxPk[k] = s1;
      }
    });
  }
  return { steps, jointMax, jointMaxPk };
}

export function runSweep(track: Track, v: Vehicle, opts: SweepOpts = {}): SweepResult {
  const step = opts.step || 0.25;
  const dst = opts.stationStep || 0.25;
  const edgeStep = opts.edgeStep || 0.3;
  const both = !!opts.both;

  const vlenTotal = vehicleLength(v);
  const sStart = opts.sStart != null ? opts.sStart : vlenTotal + 1.0;
  const sEnd = opts.sEnd != null ? opts.sEnd : track.length - 1.0;
  if (sEnd <= sStart) return { error: "El trazado es demasiado corto para este vehiculo." };

  const nSt = Math.floor(track.length / dst) + 1;
  const stS = new Float64Array(nSt);
  const stX = new Float64Array(nSt);
  const stY = new Float64Array(nSt);
  const stNx = new Float64Array(nSt);
  const stNy = new Float64Array(nSt);
  for (let k = 0; k < nSt; k++) {
    const sv = Math.min(k * dst, track.length);
    stS[k] = sv;
    const p = track.pos(sv);
    const th = track.heading(sv);
    stX[k] = p[0];
    stY[k] = p[1];
    stNx[k] = Math.cos(th + Math.PI / 2);
    stNy[k] = Math.sin(th + Math.PI / 2);
  }
  const nJoints = Math.max(0, v.modules.length - 1);

  // Ida (sentido de dibujo del eje).
  const fwdSpan = both ? 0.5 : 1;
  const fwd = solveSteps(track, v, sStart, sEnd, step, nJoints, (f) =>
    opts.onProgress?.(f * fwdSpan),
  );
  if (!fwd.steps.length)
    return {
      error:
        "No se pudo resolver la cadena cinematica en ningun punto del trazado. Revisa radios minimos vs. geometria del vehiculo.",
    };

  // Geometría maestra (E2-2): unión booleana de todas las huellas remapeada a las
  // estaciones a lo largo de la normal (aísla ramas opuestas cercanas).
  const stations: Stations = { stS, stX, stY, stNx, stNy };
  const fEnv = remapStations(fwd.steps, stations, nSt, vlenTotal, dst, edgeStep);
  const left = fEnv.left;
  const right = fEnv.right;
  let rowDir: Uint8Array | undefined;

  // Vuelta (sentido inverso): se resuelve sobre el eje invertido y se remapea a las
  // MISMAS estaciones (huellas en coordenadas absolutas). La abscisa efectiva del
  // paso se traslada al marco de ida para que la ventana longitudinal encaje: el
  // vehículo ocupa [L−s1r, L−s1r+Lveh] en abscisa de ida (E2-5).
  if (both) {
    const rTrack = reverseTrack(track);
    const rev = solveSteps(rTrack, v, sStart, sEnd, step, nJoints, (f) =>
      opts.onProgress?.(0.5 + f * 0.5),
    );
    const revStepsF = rev.steps.map((s) => ({
      s1: track.length - s.s1 + vlenTotal,
      polys: s.polys,
    }));
    const rEnv = remapStations(revStepsF, stations, nSt, vlenTotal, dst, edgeStep);
    rowDir = new Uint8Array(nSt);
    for (let k = 0; k < nSt; k++) {
      const tF = left[k] - right[k];
      const tR = rEnv.left[k] - rEnv.right[k];
      // Sentido pésimo por estación = el que da mayor ancho total en ese PK.
      rowDir[k] = tR > tF ? 1 : 0;
      if (rEnv.left[k] > left[k]) left[k] = rEnv.left[k];
      if (rEnv.right[k] < right[k]) right[k] = rEnv.right[k];
    }
  }

  const kin = opts.kin && opts.kin.enabled ? opts.kin : null;
  const kinAdd = kin ? kinStationAdd(track, kin, stS) : null;

  const rows: ProfileRow[] = [];
  const rowDirOut = both ? new Uint8Array(nSt) : undefined;
  let nRow = 0;
  for (let k = 0; k < nSt; k++)
    if (left[k] > -1e8 && right[k] < 1e8) {
      rows.push([
        stS[k],
        right[k],
        left[k],
        k,
        right[k] - (kinAdd ? kinAdd[2 * k + 1] : 0),
        left[k] + (kinAdd ? kinAdd[2 * k] : 0),
      ]);
      if (rowDirOut && rowDir) rowDirOut[nRow] = rowDir[k];
      nRow++;
    }
  const rowDirFinal = rowDirOut ? rowDirOut.slice(0, nRow) : undefined;

  let maxL = -1e9;
  let maxR = 1e9;
  let sMaxL = 0;
  let sMaxR = 0;
  let maxLK = -1e9;
  let maxRK = 1e9;
  for (const [sv, r, l, , rk, lk] of rows) {
    if (l > maxL) {
      maxL = l;
      sMaxL = sv;
    }
    if (r < maxR) {
      maxR = r;
      sMaxR = sv;
    }
    if (lk > maxLK) maxLK = lk;
    if (rk < maxRK) maxRK = rk;
  }
  const bodyHW = Math.max(...v.modules.map((m) => m.width)) / 2;
  const joints: JointResult[] = v.joints.map((j, k) => ({
    idx: k,
    label: `${v.modules[k].id || "M" + (k + 1)}↔${v.modules[k + 1].id || "M" + (k + 2)}`,
    type: j.type,
    maxAngle: fwd.jointMax[k],
    pk: fwd.jointMaxPk[k],
    limit: j.maxAngleDeg,
    exceeded: j.maxAngleDeg > 0 && fwd.jointMax[k] > j.maxAngleDeg,
  }));
  return {
    steps: fwd.steps,
    rows,
    rowDir: rowDirFinal,
    stations,
    envelope: envelopeRibbon(stations, left, right, nSt),
    joints,
    summary: {
      bodyHalfWidth: bodyHW,
      maxLeft: maxL,
      sMaxLeft: sMaxL,
      maxRight: -maxR,
      sMaxRight: sMaxR,
      totalWidth: maxL - maxR,
      kinEnabled: !!kin,
      kinMaxLeft: maxLK,
      kinMaxRight: -maxRK,
      kinTotalWidth: maxLK - maxRK,
      nSteps: fwd.steps.length,
      bidirectional: both,
    },
  };
}
