// Protocolo de mensajes entre el hilo UI y el Web Worker del barrido (E2-1).
// El barrido/clash se ejecuta en el worker para no congelar la UI; el progreso
// se reporta por PK y la cancelación se hace terminando el worker.
import type { Chain, ClashResult, KinRules, SweepResult, Vehicle } from "../types";

/**
 * Petición de cálculo. El `Track` no es clonable (contiene funciones), así que
 * se envían sus arrays crudos y el worker lo reconstruye con `makeTrack`.
 */
export interface SweepRequest {
  track: { s: Float64Array; x: Float64Array; y: Float64Array };
  vehicle: Vehicle;
  step: number;
  kin: KinRules;
  obstacles: Chain[] | null;
  requiredMargin: number;
  /** Une las envolventes de ida y vuelta (E2-5). */
  both: boolean;
}

/** Avance del barrido en [0,1]. */
export interface ProgressResponse {
  type: "progress";
  frac: number;
}

/** Resultado final: barrido + clash (si había obstáculos) + tiempo de cálculo. */
export interface DoneResponse {
  type: "done";
  sweep: SweepResult;
  clash: ClashResult | null;
  calcMs: number;
}

export type WorkerResponse = ProgressResponse | DoneResponse;
