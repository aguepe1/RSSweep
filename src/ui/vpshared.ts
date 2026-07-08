// Estado compartido del viewport CAD (E3-2): visibilidad de capas, cursor
// compartido viewport↔perfil (hover PK) y solicitud de redibujado global. Vive
// aparte para no acoplar viewport.ts y profile.ts con un import circular.

/** Abscisa de arco `s` (m) bajo el cursor, compartida entre viewport y perfil. */
export let hoverS: number | null = null;

/** Fija (o limpia) la abscisa bajo el cursor. */
export function setHoverS(s: number | null): void {
  hoverS = s;
}

let redraw: () => void = () => {};

/** Registra el redibujado global (lo cablea main con drawAll). */
export function setRedraw(fn: () => void): void {
  redraw = fn;
}

/** Pide un redibujado de viewport + perfil (para sincronizar el cursor). */
export function requestRedraw(): void {
  redraw();
}

/** ¿Está activa una capa? (checkbox `#lay<Name>`; true si no existe el control). */
export function layerOn(name: string): boolean {
  const el = document.getElementById(`lay${name}`) as HTMLInputElement | null;
  return el ? el.checked : true;
}
