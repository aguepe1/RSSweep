// Deshacer/rehacer de la edición de entrada (E3-4). Toma instantáneas de la
// parte editable de `state` (vehículo, cinemática, UIC, obstáculos) tras cada
// mutación de panel y las apila en una `UndoStack`. Estrategia por snapshots (no
// por comandos): cualquier `change`/`click` en la UI dispara un `commit` diferido
// que compara y registra solo si algo cambió. `Ctrl/Cmd+Z` deshace, `Ctrl/Cmd+Y`
// (o `Ctrl/Cmd+Shift+Z`) rehace; ambos restauran, re-renderizan y recalculan.
import type { Chain, KinRules } from "../types";
import { clone } from "./dom";
import { state } from "./state";
import type { UicState } from "./state";
import { run } from "./controller";
import { renderKinPanel, renderUicPanel, renderVehiclePanel } from "./panels";
import { UndoStack } from "./undo-stack";

/** Subconjunto editable de `state` que participa en deshacer/rehacer. */
interface Editable {
  vehicle: string; // JSON de state.vehicle
  kin: KinRules;
  uic: UicState;
  obstacles: Chain[] | null;
  obstaclesName: string;
}

/** Instantánea del estado editable (estructura JSON-plana, comparable por valor). */
function snapshot(): Editable {
  return {
    vehicle: JSON.stringify(state.vehicle),
    kin: clone(state.kin),
    uic: clone(state.uic),
    obstacles: state.obstacles ? clone(state.obstacles) : null,
    obstaclesName: state.obstaclesName,
  };
}

/** Vuelca una instantánea en `state`, re-renderiza los paneles y recalcula. */
function apply(s: Editable): void {
  state.vehicle = JSON.parse(s.vehicle);
  state.kin = clone(s.kin);
  state.uic = clone(s.uic);
  state.obstacles = s.obstacles ? clone(s.obstacles) : null;
  state.obstaclesName = s.obstaclesName;
  renderVehiclePanel(); // arrastra drawSchematic + renderJointsPanel
  renderKinPanel();
  renderUicPanel();
  const obs = document.getElementById("obsInfo");
  if (obs)
    obs.textContent = s.obstaclesName
      ? `${s.obstaclesName} · ${s.obstacles?.length ?? 0} entidad(es)`
      : "";
  const clr = document.getElementById("btnObsClear");
  if (clr) clr.style.display = s.obstaclesName ? "inline-block" : "none";
  run();
}

let stack: UndoStack<Editable> | null = null;
let pending = false;

/** Refresca el estado deshabilitado de los botones de menú Deshacer/Rehacer. */
function syncButtons(): void {
  if (!stack) return;
  const u = document.getElementById("menuUndo") as HTMLButtonElement | null;
  const r = document.getElementById("menuRedo") as HTMLButtonElement | null;
  if (u) u.disabled = !stack.canUndo;
  if (r) r.disabled = !stack.canRedo;
}

/** Registra el estado actual si difiere del presente (diferido para coalescer). */
function scheduleCommit(): void {
  if (pending || !stack) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    stack!.push(snapshot());
    syncButtons();
  });
}

function undoOp(): void {
  const s = stack?.undoStep();
  if (s) {
    apply(s);
    syncButtons();
  }
}

function redoOp(): void {
  const s = stack?.redoStep();
  if (s) {
    apply(s);
    syncButtons();
  }
}

/** Cablea la pila de deshacer/rehacer: baseline, teclado, menú y captura de cambios. */
export function initHistory(): void {
  stack = new UndoStack<Editable>(snapshot());
  syncButtons();

  // Cualquier edición de panel (change) o acción de botón (click) puede mutar el
  // estado editable; se registra de forma diferida para agrupar ráfagas.
  document.addEventListener("change", scheduleCommit);
  document.addEventListener("click", scheduleCommit);

  document.getElementById("menuUndo")?.addEventListener("click", undoOp);
  document.getElementById("menuRedo")?.addEventListener("click", redoOp);

  window.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undoOp();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      redoOp();
    }
  });
}
