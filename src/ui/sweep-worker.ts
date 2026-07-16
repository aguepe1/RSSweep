// Web Worker del barrido (E2-1): ejecuta runSweep + clashCheck fuera del hilo
// UI. Reconstruye el Track a partir de sus arrays (las funciones no cruzan el
// postMessage), reporta progreso por PK (throttled a 1%) y devuelve el
// resultado. La cancelación la gestiona el hilo UI terminando el worker.
import { clashCheck, makeTrack, runSweep } from "../engine/index";
import type { SweepRequest, WorkerResponse } from "./worker-protocol";

// El scope global del worker se tipa con DOM lib (self ≈ Window). Se acota a la
// superficie que usamos para evitar el conflicto de libs DOM/WebWorker.
const ctx = self as unknown as {
  postMessage(m: WorkerResponse): void;
  onmessage: ((e: MessageEvent<SweepRequest>) => void) | null;
};

ctx.onmessage = (e: MessageEvent<SweepRequest>) => {
  const req = e.data;
  const track = makeTrack(req.track.s, req.track.x, req.track.y);

  let lastPct = -1;
  const t0 = performance.now();
  const sweep = runSweep(track, req.vehicle, {
    step: req.step,
    kin: req.kin,
    both: req.both,
    fullTraversal: req.fullTraversal,
    onProgress: (frac) => {
      const pct = Math.floor(frac * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        ctx.postMessage({ type: "progress", frac });
      }
    },
  });
  const calcMs = performance.now() - t0;

  const clash =
    !sweep.error && req.obstacles
      ? clashCheck(track, sweep, req.obstacles, req.requiredMargin)
      : null;

  ctx.postMessage({ type: "done", sweep, clash, calcMs });
};
