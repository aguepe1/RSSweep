// PK de proyecto (E2-4): traduce la abscisa de arco interna `s` (m) al PK de
// proyecto del alignment LandXML cargado. Sin mapa, PK = s (identidad).
import { pkAt } from "../engine/index";
import { fmt } from "./dom";
import { state } from "./state";

/** PK de proyecto en la abscisa de arco `s` (número). */
export function pkVal(s: number): number {
  return pkAt(state.pkMap, s);
}

/** PK de proyecto formateado (es-ES) para mostrar en UI/CSV. */
export function pkFmt(s: number, d = 1): string {
  return fmt(pkVal(s), d);
}
