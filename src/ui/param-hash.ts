// HASH DE PARÁMETROS — huella determinista (FNV-1a 32-bit → 8 hex) del JSON canónico
// de las entradas. Dos exportaciones con el mismo hash provienen de los mismos
// parámetros (reproducibilidad). Compartido por el informe (E4-1) y el DXF (E4-2).
import { state } from "./state";

export function paramHash(): string {
  const r3 = (x: number): number => Math.round(x * 1000) / 1000;
  const canon = {
    v: state.vehicle,
    kin: state.kin.enabled ? state.kin : null,
    uic: state.uic.enabled ? state.uic : null,
    consist: state.consist.enabled ? state.consist : null,
    track: { name: state.trackName, len: r3(state.track?.length ?? 0), gauge: state.gauge },
  };
  const str = JSON.stringify(canon);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
