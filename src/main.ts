// Punto de entrada de la UI. Cablea paneles, viewport, perfil y controlador,
// y ejecuta el arranque (render de paneles + preset 0 + primer cálculo).
import "./ui/fonts";
import { VERSION } from "./version";
import { state } from "./ui/state";
import { $, resizeCanvas } from "./ui/dom";
import {
  initPanels,
  loadPreset,
  renderKinPanel,
  renderUicPanel,
  renderVehiclePanel,
} from "./ui/panels";
import { initViewport } from "./ui/viewport";
import { initProfile, drawProfile, profileCanvas } from "./ui/profile";
import { initController, drawAll, run } from "./ui/controller";
import { initSchematic, drawSchematic } from "./ui/schematic";
import { activeHyp, initLayout, updateStatusBar } from "./ui/layout";
import { initProject } from "./ui/project";
import { initHistory } from "./ui/history";
import { renderCartouche } from "./ui/cartouche";
import { initI18n, t } from "./ui/i18n";
import { initShortcuts } from "./ui/shortcuts";
import { setRedraw } from "./ui/vpshared";

/** Re-renderiza las partes con texto dinámico tras un cambio de idioma. */
function relocalize(): void {
  renderVehiclePanel(); // tfoot «N módulos» + esquema
  renderKinPanel();
  renderUicPanel();
  renderCartouche();
  updateStatusBar({
    file: state.trackName || "—",
    hyp: activeHyp(),
    steps: state.sweep?.summary?.nSteps,
    timeMs: state.calcMs,
  });
  $("btnPlay").textContent = state.playing ? t("btn.pause") : t("btn.play");
}

function boot(): void {
  // Idioma primero: fija la locale (guardada) y reescribe los textos estáticos
  // antes de cualquier render dinámico, para que cajetín/paneles usen `t()` bien.
  initI18n(relocalize);

  // versión visible en la barra de cabecera (además del cajetín y los exports)
  const sub = document.getElementById("appSub");
  if (sub) sub.textContent = `v${VERSION} · huella + envolvente cinemática + clash check + UIC 505`;

  initProfile();
  initViewport(drawAll);
  setRedraw(drawAll);
  initController();
  initSchematic();
  initLayout();
  initPanels();
  initProject();

  // redibujado al redimensionar el viewport (arrastra también el perfil)
  const vp = document.getElementById("viewport") as HTMLCanvasElement;
  new ResizeObserver(() => {
    resizeCanvas(vp);
    resizeCanvas(profileCanvas());
    drawAll();
    drawSchematic();
  }).observe(vp);

  renderVehiclePanel();
  renderKinPanel();
  renderUicPanel();
  loadPreset(0);
  run();
  drawProfile();

  // Deshacer/rehacer: se cablea al final para que la baseline sea el estado por defecto.
  initHistory();

  // Atajos de teclado globales (§5): Space, ←→, F, 1–5, Ctrl+S, Ctrl+P.
  initShortcuts();

  // Handle de diagnóstico para inspección y tests e2e (no usado por la app).
  (window as unknown as { __barrido: unknown }).__barrido = { state };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
