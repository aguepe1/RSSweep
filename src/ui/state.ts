// Estado global de la UI. Un único objeto mutable compartido por los módulos
// (paneles, viewport, perfil, controlador). En E3 se sustituirá por un store real.
import { defaultKin, VEHICLE_PRESETS } from "../engine/index";
import type {
  Chain,
  ClashResult,
  KinRules,
  PkMap,
  SweepResult,
  Track,
  UicParams,
  Vehicle,
} from "../types";
import { clone } from "./dom";

/** Parámetros UIC + flag de activación de la comparación. */
export type UicState = UicParams & { enabled: boolean };

/** Encuadre del viewport (pan/zoom en píxeles CSS). */
export interface ViewState {
  scale: number;
  ox: number;
  oy: number;
}

export interface AppState {
  vehicle: Vehicle;
  kin: KinRules;
  obstacles: Chain[] | null;
  obstaclesName: string;
  clash: ClashResult | null;
  uic: UicState;
  track: Track | null;
  trackName: string;
  trackLen: number;
  /** Ancho de vía (m) entre carriles. Presentación: dibuja los dos carriles a
   *  ±gauge/2 del eje. No cambia la envolvente (el eje montado sigue la línea
   *  media dentro del juego de pestaña ya modelado). Default estándar 1.435. */
  gauge: number;
  /** Mapa de PK de proyecto (LandXML, E2-4). null ⇒ PK = longitud de arco. */
  pkMap: PkMap | null;
  sweep: SweepResult | null;
  playIdx: number;
  playing: boolean;
  calcMs: number;
  view: ViewState;
}

export const state: AppState = {
  vehicle: clone(VEHICLE_PRESETS[0].vehicle),
  kin: defaultKin(),
  obstacles: null,
  obstaclesName: "",
  clash: null,
  uic: { enabled: false, a: 13.9, na: 2.3, p: 1.85, b: 1.325 },
  track: null,
  trackName: "",
  trackLen: 0,
  gauge: 1.435,
  pkMap: null,
  sweep: null,
  playIdx: 0,
  playing: false,
  calcMs: 0,
  view: { scale: 8, ox: 0, oy: 0 },
};
