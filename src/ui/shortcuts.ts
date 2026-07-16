// Atajos de teclado globales (DESIGN_SPEC §5). Se implementan reutilizando los
// controles ya existentes del shell (disparando `click`/`input`/`change` sobre
// ellos), de modo que la lógica vive en un único sitio y no se duplica. Los atajos
// con modificador (Ctrl/Cmd+Z/Y, undo/redo) se cablean en `history.ts`; aquí van
// Space, ←→, F, M-adyacentes (M vive en viewport), 1–5, Ctrl+S y Ctrl+P.
//
// No se disparan mientras el foco está en un campo editable (INPUT/SELECT/TEXTAREA),
// salvo el rango de scrub, para no interferir con la escritura.

import { isTrainEditorOpen } from "./train-editor";

/** ¿El usuario pidió movimiento reducido? (sin auto-reproducción animada). */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** ¿El foco está en un control que consume las teclas (para no secuestrarlas)? */
function inEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  // el rango de scrub no consume letras/números, así que no lo tratamos como editable
  if (tag === "INPUT" && (el as HTMLInputElement).type === "range") return false;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

/** Mueve el deslizador de reproducción `delta` pasos (dispara el handler existente). */
function scrubBy(delta: number): void {
  const s = document.getElementById("scrub") as HTMLInputElement | null;
  if (!s) return;
  const min = Number(s.min || "0");
  const max = Number(s.max || "0");
  const next = Math.max(min, Math.min(max, Number(s.value) + delta));
  if (next === Number(s.value)) return;
  s.value = String(next);
  s.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Conmuta la capa `n` (1..6) del viewport disparando el `change` de su checkbox. */
function toggleLayer(n: number): void {
  const ids = ["layFootprint", "layKin", "layUic", "layObs", "layVeh", "layRail"];
  const el = document.getElementById(ids[n - 1]) as HTMLInputElement | null;
  if (!el) return;
  el.checked = !el.checked;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Simula un clic sobre un botón existente (reutiliza su handler). */
function trigger(id: string): void {
  document.getElementById(id)?.click();
}

/** Cablea los atajos globales de teclado (§5). */
export function initShortcuts(): void {
  window.addEventListener("keydown", (e) => {
    // Con el editor del tren abierto, sus propios controles gobiernan el teclado
    // (Esc cierra); no dejamos que los atajos del shell se filtren.
    if (isTrainEditorOpen()) return;
    const mod = e.ctrlKey || e.metaKey;

    // Atajos con modificador: guardar (Ctrl+S) e informe (Ctrl+P).
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        trigger("menuSave");
        return;
      }
      if (k === "p") {
        e.preventDefault();
        trigger("menuReports"); // abre el desplegable de informes (E4 los desarrolla)
        return;
      }
      return; // otros modificadores (Z/Y) los gestiona history.ts
    }
    if (mod) return;

    if (inEditable(e.target)) return;

    switch (e.key) {
      case " ":
      case "Spacebar":
        e.preventDefault();
        trigger("btnPlay");
        break;
      case "ArrowLeft":
        e.preventDefault();
        scrubBy(e.shiftKey ? -10 : -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        scrubBy(e.shiftKey ? 10 : 1);
        break;
      case "f":
      case "F":
        e.preventDefault();
        trigger("btnFit");
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
        e.preventDefault();
        toggleLayer(Number(e.key));
        break;
    }
  });
}
