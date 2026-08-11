// Orquestación: validación + cálculo del barrido, estado, reproducción y
// exportación (DXF/CSV). Depende de viewport/perfil/cajetín para redibujar.
import {
  buildConsist,
  hasBisectriz,
  validateVehicle,
  vehicleWarnings,
  writeDXF,
} from "../engine/index";
import { APP_NAME, VERSION } from "../version";
import { $, download, fmt } from "./dom";
import { pkVal } from "./pk";
import { paramHash } from "./param-hash";
import { state } from "./state";
import SweepWorker from "./sweep-worker?worker&inline";
import type { SweepRequest, WorkerResponse } from "./worker-protocol";

/** Cabecera de metadatos para exports CSV (líneas de comentario `#`). */
function csvMeta(what: string): string {
  return `# ${APP_NAME} ${VERSION} — ${what} — ${new Date().toISOString()}`;
}
import { drawViewport, fitView } from "./viewport";
import { drawProfile } from "./profile";
import { renderCartouche } from "./cartouche";
import { renderJointsPanel } from "./panels";
import { activeHyp, updateStatusBar } from "./layout";
import { saveAutosave } from "./project";
import { t } from "./i18n";
import { prefersReducedMotion } from "./shortcuts";

export function drawAll(): void {
  drawViewport();
  drawProfile();
}

export function setStatus(msg: string, isErr = false): void {
  const el = $("status");
  el.textContent = msg;
  el.className = isErr ? "error" : "";
  el.style.display = msg ? "block" : "none";
}

export function stopPlay(): void {
  state.playing = false;
  $("btnPlay").textContent = t("btn.play");
}

/** Worker de barrido en curso (E2-1); `null` cuando no hay cálculo activo. */
let worker: Worker | null = null;

/** Muestra/oculta la barra de progreso; `null` la oculta. */
function setProgress(frac: number | null): void {
  const wrap = $("progressWrap");
  if (frac == null) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  $("progressBar").style.width = `${Math.round(frac * 100)}%`;
}

/** Termina el worker en curso (cancelación) y libera la referencia. */
function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/** Cancela el cálculo en curso desde la UI. */
export function cancelRun(): void {
  if (!worker) return;
  terminateWorker();
  setProgress(null);
  setStatus("Cálculo cancelado.");
}

export function run(): void {
  stopPlay();
  terminateWorker();
  const errs = validateVehicle(state.vehicle);
  $("vehErrors").textContent = errs.join(" · ");
  // Avisos NO bloqueantes de colocación del bogie (vuelo/empate, E4-B3).
  $("vehWarnings").textContent = vehicleWarnings(state.vehicle).join(" · ");
  if (errs.length || !state.track) {
    setProgress(null);
    return;
  }
  // cabinas automáticas en extremos (del tren primario, para el editor/esquema)
  state.vehicle.modules.forEach((m, i) => {
    m.cabFront = i === 0;
    m.cabRear = i === state.vehicle.modules.length - 1;
  });

  // Vehículo efectivo del barrido: si hay dos trenes acoplados, se ensambla
  // A ▸ enganche ▸ B (buildConsist); si no, es el tren primario tal cual. El
  // editor/paneles siguen operando sobre `state.vehicle` (tren A).
  const effVeh =
    state.consist.enabled && state.track
      ? buildConsist(state.vehicle, state.consist.trainB ?? state.vehicle, state.consist.coupler)
      : state.vehicle;
  if (state.consist.enabled) {
    const cErrs = validateVehicle(effVeh);
    if (cErrs.length) {
      $("vehErrors").textContent = cErrs.join(" · ");
      setProgress(null);
      return;
    }
  }

  setStatus(
    hasBisectriz(effVeh)
      ? "Calculando… (equilibrio de bielas de centrado, puede tardar unos segundos)"
      : "Calculando…",
  );
  setProgress(0);
  updateStatusBar({ file: state.trackName || "—", hyp: activeHyp() });
  $<HTMLButtonElement>("btnDxfOut").disabled = true;
  $<HTMLButtonElement>("btnCsvOut").disabled = true;

  const track = state.track;
  const req: SweepRequest = {
    track: { s: track.s, x: track.x, y: track.y },
    vehicle: effVeh,
    step: parseFloat($<HTMLInputElement>("simStep").value) || 0.25,
    kin: state.kin,
    obstacles: state.obstacles,
    requiredMargin: (parseFloat($<HTMLInputElement>("reqMargin").value) || 0) / 1000,
    both: $<HTMLInputElement>("bothDirs").checked,
    fullTraversal: $<HTMLInputElement>("fullTraversal").checked,
  };

  const w = new SweepWorker();
  worker = w;
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    if (msg.type === "progress") {
      setProgress(msg.frac);
      return;
    }
    terminateWorker();
    setProgress(null);
    state.calcMs = msg.calcMs;
    const sw = msg.sweep;
    if (sw.error) {
      state.sweep = null;
      setStatus(sw.error, true);
      drawAll();
      renderCartouche();
      renderJointsPanel();
      return;
    }
    state.sweep = sw;
    state.playIdx = 0;
    const scrub = $<HTMLInputElement>("scrub");
    scrub.max = String(sw.steps!.length - 1);
    scrub.value = "0";
    $<HTMLButtonElement>("btnDxfOut").disabled = false;
    $<HTMLButtonElement>("btnCsvOut").disabled = false;
    state.clash = msg.clash;
    $("btnClashOut").style.display = state.clash ? "inline-block" : "none";
    $<HTMLButtonElement>("btnClashOut").disabled = !state.clash;
    setStatus("");
    fitView();
    drawAll();
    renderCartouche();
    renderJointsPanel(); // refresca las barras de ángulo máx / PK crítico
    updateStatusBar({ steps: sw.steps!.length, timeMs: msg.calcMs });
    saveAutosave(); // persiste la sesión en localStorage tras cada cálculo (E3-3)
  };
  w.postMessage(req);
}

function tick(): void {
  if (!state.playing || !state.sweep) return;
  state.playIdx = (state.playIdx + 1) % state.sweep.steps!.length;
  $<HTMLInputElement>("scrub").value = String(state.playIdx);
  drawViewport();
  drawProfile();
  requestAnimationFrame(tick);
}

/** Cablea cálculo, reproducción y exportaciones. */
export function initController(): void {
  $("btnRun").addEventListener("click", run);
  $("btnCancel").addEventListener("click", cancelRun);
  $("simStep").addEventListener("change", run);
  $("bothDirs").addEventListener("change", run);
  $("fullTraversal").addEventListener("change", run);

  $("btnPlay").addEventListener("click", () => {
    if (!state.sweep) return;
    // Movimiento reducido (a11y §5): sin reproducción automática animada; el
    // usuario recorre los PK con el deslizador o las flechas ←→.
    if (prefersReducedMotion() && !state.playing) return;
    state.playing = !state.playing;
    $("btnPlay").textContent = state.playing ? t("btn.pause") : t("btn.play");
    if (state.playing) requestAnimationFrame(tick);
  });
  $("scrub").addEventListener("input", (e) => {
    stopPlay();
    state.playIdx = +(e.target as HTMLInputElement).value;
    drawViewport();
    drawProfile();
  });

  $("btnDxfOut").addEventListener("click", () => {
    if (!state.sweep) return;
    download(
      "huella_barrida.dxf",
      writeDXF(state.track!, state.sweep, {
        obstacles: state.obstacles,
        clash: state.clash,
        pkOf: pkVal,
        hatch: true,
        meta: [
          `${APP_NAME} ${VERSION} — export ${new Date().toISOString()}`,
          `hash ${paramHash()}`,
        ],
      }),
      "application/dxf",
    );
  });
  $("btnCsvOut").addEventListener("click", () => {
    if (!state.sweep) return;
    const kinOn = state.sweep.summary!.kinEnabled;
    const dir = state.sweep.rowDir;
    const bidir = !!dir;
    const header = "pk_m;offset_dcha_m;offset_izq_m;ancho_m";
    const lines = [
      csvMeta("perfil de semianchos"),
      (kinOn ? header + ";kin_dcha_m;kin_izq_m;kin_ancho_m" : header) + (bidir ? ";sentido" : ""),
    ];
    state.sweep.rows!.forEach(([s, r, l, , rk, lk], i) => {
      const base = [fmt(pkVal(s), 3), fmt(r, 4), fmt(l, 4), fmt(l - r, 4)];
      if (kinOn) base.push(fmt(rk, 4), fmt(lk, 4), fmt(lk - rk, 4));
      if (bidir) base.push(dir[i] ? "vuelta" : "ida");
      lines.push(base.map((x) => String(x).replace(",", ".")).join(";"));
    });
    download("perfil_semianchos.csv", lines.join("\n"), "text/csv");
  });
  $("btnClashOut").addEventListener("click", () => {
    if (!state.clash) return;
    const lines = [csvMeta("informe de gálibo"), "pk_m;x;y;offset_m;margen_mm;estado"];
    for (const r of state.clash.points)
      lines.push(
        [
          fmt(pkVal(r.pk), 2),
          fmt(r.x, 3),
          fmt(r.y, 3),
          fmt(r.off, 3),
          fmt(r.margin * 1000, 0),
          r.viol ? "INVASION" : "OK",
        ]
          .map((x) => String(x).replace(",", "."))
          .join(";"),
      );
    download("informe_galibo.csv", lines.join("\n"), "text/csv");
  });
}
