// Layout §4 («mesa de delineación digital»): barra de menú desplegable, panel de
// entrada en pestañas (Vehículo/Trazado/Reglas/Obstáculos), zonas laterales
// colapsables y redimensionables por arrastre del gutter, y barra de estado.
// No toca el motor; sólo reordena y conmuta la visibilidad de controles ya
// existentes (todos conservan su `id`).
import { $ } from "./dom";
import { VERSION } from "../version";
import { state } from "./state";
import { t } from "./i18n";

/** Activa la pestaña `name` del panel de entrada y su botón. */
export function activateTab(name: string): void {
  document.querySelectorAll<HTMLElement>(".tabpanel").forEach((p) => {
    p.classList.toggle("active", p.dataset.tab === name);
  });
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
    b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false");
  });
}

/** Cierra todos los menús desplegables abiertos. */
function closeMenus(): void {
  document.querySelectorAll(".mitem.open").forEach((m) => m.classList.remove("open"));
}

function initMenu(): void {
  document.querySelectorAll<HTMLElement>(".mitem").forEach((item) => {
    const btn = item.querySelector<HTMLElement>(".mbtn");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tab = btn.dataset.tab;
      if (tab) activateTab(tab);
      const wasOpen = item.classList.contains("open");
      closeMenus();
      // sólo abre desplegable si lo tiene (no los items que son atajo de pestaña)
      if (!wasOpen && item.querySelector(".mdrop")) item.classList.add("open");
    });
  });
  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });

  // Opciones de menú que delegan en botones existentes.
  const proxy: Array<[string, string, string?]> = [
    ["menuRun", "btnRun", "reglas"],
    ["menuCancel", "btnCancel", "reglas"],
    ["menuCsvOut", "btnCsvOut"],
    ["menuDxfOut", "btnDxfOut"],
    ["menuClashOut", "btnClashOut"],
  ];
  for (const [src, target, tab] of proxy) {
    const el = document.getElementById(src);
    if (!el) continue;
    el.addEventListener("click", () => {
      if (tab) activateTab(tab);
      closeMenus();
      document.getElementById(target)?.click();
    });
  }
}

/** Colapsar/expandir un panel lateral y redimensionarlo arrastrando su gutter. */
function initPanelResize(): void {
  const mid = $("mid");

  const setup = (side: "left" | "right"): void => {
    const gutter = document.getElementById(`gutter-${side}`);
    const varName = side === "left" ? "--lw" : "--rw";
    const collapseBtn = document.getElementById(`collapse-${side}`);
    const min = 220,
      max = 620;

    collapseBtn?.addEventListener("click", () => {
      mid.classList.toggle(`${side}-collapsed`);
    });

    if (!gutter) return;
    gutter.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      gutter.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = parseFloat(getComputedStyle(mid).getPropertyValue(varName)) || 360;
      const onMove = (ev: PointerEvent): void => {
        const dx = ev.clientX - startX;
        const raw = side === "left" ? startW + dx : startW - dx;
        const w = Math.max(min, Math.min(max, raw));
        mid.style.setProperty(varName, `${w}px`);
      };
      const onUp = (): void => {
        gutter.removeEventListener("pointermove", onMove);
        gutter.removeEventListener("pointerup", onUp);
      };
      gutter.addEventListener("pointermove", onMove);
      gutter.addEventListener("pointerup", onUp);
    });
  };

  setup("left");
  setup("right");
}

/** Rellena los campos estáticos de la barra de estado. */
function initStatusBar(): void {
  const ver = $("statusBarVersion");
  if (ver) ver.textContent = `v${VERSION}`;
  const units = $("statusBarUnits");
  if (units) units.textContent = t("sb.units");
}

/** Actualiza la barra de estado tras un cálculo (pasos, tiempo, fichero, hipótesis). */
export function updateStatusBar(opts: {
  steps?: number;
  timeMs?: number;
  file?: string;
  hyp?: string;
}): void {
  const set = (id: string, txt: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  if (opts.file != null) set("statusBarFile", opts.file);
  if (opts.hyp != null) set("statusBarHyp", opts.hyp);
  if (opts.steps != null) set("statusBarSteps", `${opts.steps} ${t("cart.stepsUnit")}`);
  if (opts.timeMs != null) set("statusBarTime", `${Math.round(opts.timeMs)} ms`);
}

/** Devuelve la lista de hipótesis activas para la barra de estado. */
export function activeHyp(): string {
  const on = (id: string): boolean => !!document.querySelector<HTMLInputElement>(`#${id}`)?.checked;
  const parts: string[] = [t("hyp.geo")];
  if (on("kinEnabled")) parts.push(t("hyp.kin"));
  if (on("uicEnabled")) parts.push(t("hyp.uic"));
  if (on("bothDirs")) parts.push(t("hyp.bidir"));
  if (on("fullTraversal")) parts.push(t("hyp.fullTraversal"));
  return parts.join(" · ");
}

/** Cablea menú, pestañas, colapsado/redimensionado de paneles y barra de estado. */
export function initLayout(): void {
  initMenu();
  initPanelResize();
  initStatusBar();
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.dataset.tab || "veh"));
  });

  // Navegación de la narrativa secuencial: botones «Siguiente / Anterior» que
  // saltan de una pestaña-paso a otra (delegan en `activateTab`, misma semántica
  // que pulsar la pestaña). El panel de entrada se hace scroll al inicio.
  document.querySelectorAll<HTMLElement>("[data-goto]").forEach((b) => {
    b.addEventListener("click", () => {
      activateTab(b.dataset.goto || "veh");
      document.querySelector(".panel-body")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Atajo «Calcular huella» del último paso: reutiliza el botón de cálculo real.
  document.getElementById("btnRunFromObs")?.addEventListener("click", () => {
    document.getElementById("btnRun")?.click();
  });

  activateTab("veh");
  updateStatusBar({ file: state.trackName || "—", hyp: activeHyp() });
}
