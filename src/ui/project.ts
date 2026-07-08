// Proyecto como fichero (E3-3): serializa el estado editable a un documento
// `.barrido.json` versionado y lo restaura. El eje se guarda como su polilínea
// cruda (s,x,y) y se reconstruye con `makeTrack` (igual que el worker), de modo
// que abrir un proyecto reproduce el cálculo bit a bit. Autosave en localStorage
// con recuperación al arrancar mediante un banner. Sin dependencias externas.
import { defaultKin, makeTrack, VEHICLE_PRESETS } from "../engine/index";
import type { Chain, KinRules, PkMap, Vehicle } from "../types";
import { VERSION } from "../version";
import { $, clone, download, fmt } from "./dom";
import { state } from "./state";
import type { UicState, ViewState } from "./state";
import { run } from "./controller";
import { loadPreset, renderKinPanel, renderUicPanel, renderVehiclePanel } from "./panels";
import { drawSchematic } from "./schematic";
import { fitView } from "./viewport";

const SCHEMA = 1;
const LS_KEY = "barrido.autosave.v1";

/** Eje serializado: polilínea cruda por longitud de arco + nombre. */
interface SerTrack {
  s: number[];
  x: number[];
  y: number[];
  name: string;
}

/** Documento de proyecto `.barrido.json` (esquema versionado). */
export interface BarridoProject {
  schema: number;
  /** Versión de BARRIDO que generó el documento (informativo). */
  app: string;
  vehicle: Vehicle;
  kin: KinRules;
  uic: UicState;
  obstacles: Chain[] | null;
  obstaclesName: string;
  track: SerTrack | null;
  pkMap: PkMap | null;
  view: ViewState;
}

/** Copia del autosave hallado al arrancar (antes de que el primer cálculo lo pise). */
let recovered: string | null = null;

/** Instantánea serializable del estado editable actual. */
export function serializeProject(): BarridoProject {
  const t = state.track;
  return {
    schema: SCHEMA,
    app: VERSION,
    vehicle: clone(state.vehicle),
    kin: clone(state.kin),
    uic: clone(state.uic),
    obstacles: state.obstacles ? clone(state.obstacles) : null,
    obstaclesName: state.obstaclesName,
    track: t
      ? { s: Array.from(t.s), x: Array.from(t.x), y: Array.from(t.y), name: state.trackName }
      : null,
    pkMap: state.pkMap ? clone(state.pkMap) : null,
    view: clone(state.view),
  };
}

/** Migra/valida un documento a la versión actual del esquema (o lanza). */
function migrate(doc: BarridoProject): BarridoProject {
  if (!doc || typeof doc !== "object") throw new Error("documento vacío o no es JSON");
  if (typeof doc.schema !== "number") throw new Error("falta el campo 'schema'");
  if (doc.schema > SCHEMA)
    throw new Error(`proyecto de un esquema más nuevo (v${doc.schema}); actualiza BARRIDO`);
  if (!doc.vehicle || !Array.isArray(doc.vehicle.modules))
    throw new Error("el proyecto no contiene un vehículo con módulos");
  return doc;
}

/** Carga un documento de proyecto en el estado y recalcula. */
export function applyProject(doc: BarridoProject): void {
  const p = migrate(doc);
  state.vehicle = clone(p.vehicle);
  state.kin = clone(p.kin);
  state.uic = clone(p.uic);
  state.obstacles = p.obstacles ? clone(p.obstacles) : null;
  state.obstaclesName = p.obstaclesName || "";
  if (p.track) {
    state.track = makeTrack(
      Float64Array.from(p.track.s),
      Float64Array.from(p.track.x),
      Float64Array.from(p.track.y),
    );
    state.trackName = p.track.name;
  } else {
    state.track = null;
    state.trackName = "";
  }
  state.pkMap = p.pkMap ?? null;
  state.view = clone(p.view);
  refreshInputUI();
  run(); // recalcula; el encuadre se reajusta automáticamente como en todo cálculo
}

/** Restaura el proyecto por defecto (preset 0 de vehículo y de trazado). */
export function newProject(): void {
  state.vehicle = clone(VEHICLE_PRESETS[0].vehicle);
  state.kin = defaultKin();
  state.uic = { enabled: false, a: 13.9, na: 2.3, p: 1.85, b: 1.325 };
  state.obstacles = null;
  state.obstaclesName = "";
  loadPreset(0);
  refreshInputUI();
  fitView();
  run();
}

/** Re-render de los paneles y textos de entrada tras cambiar `state`. */
function refreshInputUI(): void {
  renderVehiclePanel();
  renderKinPanel();
  renderUicPanel();
  drawSchematic();
  $<HTMLSelectElement>("trackPreset").selectedIndex = -1;
  $("dxfLayerRow").style.display = "none";
  $("dxfFlipRow").style.display = "none";
  $("trackInfo").textContent = state.track
    ? `${state.trackName} · L = ${fmt(state.track.length, 2)} m`
    : "";
  $("obsInfo").textContent = state.obstaclesName
    ? `${state.obstaclesName} · ${state.obstacles?.length ?? 0} entidad(es)`
    : "";
}

/** Guarda el estado actual como `.barrido.json`. */
export function saveProject(): void {
  download(
    "proyecto.barrido.json",
    JSON.stringify(serializeProject(), null, 2),
    "application/json",
  );
}

/** Persiste el estado en localStorage (autosave). Silencioso ante cuota/errores. */
export function saveAutosave(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(serializeProject()));
  } catch {
    /* almacenamiento no disponible o lleno: el autosave es best-effort */
  }
}

/** Lee un fichero de texto y lo aplica como proyecto (con aviso de error). */
async function openFromFile(f: File): Promise<void> {
  try {
    applyProject(JSON.parse(await f.text()) as BarridoProject);
  } catch (err) {
    $("trackWarnings").textContent = "Proyecto no válido: " + (err as Error).message;
  }
}

/** Cablea el menú Archivo, arrastrar-soltar, autosave y el banner de recuperación. */
export function initProject(): void {
  // Captura el autosave previo ANTES de que el primer cálculo lo sobrescriba.
  try {
    recovered = localStorage.getItem(LS_KEY);
  } catch {
    recovered = null;
  }
  const banner = document.getElementById("recoverBanner");
  if (recovered && banner) banner.hidden = false;

  $("menuNew").addEventListener("click", newProject);
  $("menuSave").addEventListener("click", saveProject);
  $("menuOpen").addEventListener("click", () => $<HTMLInputElement>("fileProject").click());
  $("fileProject").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) await openFromFile(f);
    input.value = "";
  });

  $("btnRecover")?.addEventListener("click", () => {
    if (recovered) {
      try {
        applyProject(JSON.parse(recovered) as BarridoProject);
      } catch (err) {
        $("trackWarnings").textContent = "No se pudo recuperar: " + (err as Error).message;
      }
    }
    if (banner) banner.hidden = true;
  });
  $("btnDiscardRecover")?.addEventListener("click", () => {
    if (banner) banner.hidden = true;
  });

  // Arrastrar y soltar un `.json` de proyecto sobre la ventana.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && /\.json$/i.test(f.name)) void openFromFile(f);
  });
}
