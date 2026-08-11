// Focus-trap para diálogos modales (train-editor, report): mantiene el foco de
// teclado dentro del contenedor mientras está abierto, de modo que Tab/Shift+Tab
// circulan solo por los controles del diálogo y no se escapan al fondo. La gestión
// de Escape y de restauración de foco al cerrar la hacen los propios diálogos.
const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elementos enfocables visibles dentro del contenedor. */
function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    (el) => !el.hidden && el.offsetParent !== null,
  );
}

/**
 * Instala un focus-trap en `container`. Devuelve una función para desinstalarlo.
 * Mientras está activo, Tab desde el último elemento vuelve al primero y
 * Shift+Tab desde el primero salta al último.
 */
export function trapFocus(container: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Tab") return;
    const items = focusable(container);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown", onKey);
  return () => container.removeEventListener("keydown", onKey);
}
