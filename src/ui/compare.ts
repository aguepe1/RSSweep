// Perfil de comparación UIC 505-1 para el barrido actual (usado por viewport,
// perfil y cajetín). Devuelve null si la comparación está desactivada o no hay
// cálculo todavía.
import { uic505Profile } from "../engine/index";
import { state } from "./state";

export function uicRows(): Array<[number, number]> | null {
  if (!state.uic.enabled || !state.sweep || !state.track) return null;
  return uic505Profile(state.track, state.uic, state.sweep.rows!);
}
