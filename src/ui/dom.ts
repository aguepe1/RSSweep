// Helpers de DOM y formato compartidos por la UI.
// Unidades de UI: la conversión m↔mm vive aquí y en los paneles, nunca en el motor.
import { numLocale } from "./i18n";

/** getElementById con tipo esperado (el llamador conoce el elemento del shell). */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} no encontrado en el shell`);
  return el as T;
}

/** Clon profundo por serialización (los objetos de estado son JSON-planos). */
export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/**
 * Formato con `d` decimales según la locale de presentación activa; "—" para
 * valores no finitos. Los exports CSV normalizan la coma decimal a punto, de modo
 * que este formato es solo de presentación (no altera el separador de los CSV).
 */
export function fmt(x: number | null | undefined, d = 3): string {
  return x == null || !isFinite(x)
    ? "—"
    : x.toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Ajusta el buffer del canvas a su tamaño CSS × devicePixelRatio. */
export function resizeCanvas(c: HTMLCanvasElement): void {
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * dpr)) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
}

/** Descarga un blob de texto como fichero (export DXF/CSV/JSON). */
export function download(name: string, content: string, mime: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Descarga binaria (p. ej. .xlsx) desde un Uint8Array. */
export function downloadBytes(name: string, bytes: Uint8Array, mime: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
