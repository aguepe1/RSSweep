// MODELO Y LÍMITES (E5-3) — página de ayuda en-app: explica el modelo físico del
// motor y sus límites declarados (ENGINE_NOTES §1/§5). La honestidad sobre los
// límites del modelo es un feature: nunca se suavizan los disclaimers de EN 15273 /
// UIC 505. Solo presentación (no toca el motor ni los dorados). Diálogo modal con
// focus-trap, Escape y restauración de foco al cerrar.
import { $ } from "./dom";
import { t } from "./i18n";
import { trapFocus } from "./focus-trap";

let viewEl: HTMLElement;
let bodyEl: HTMLElement;
let opened = false;
let releaseTrap: (() => void) | null = null;

export function isModelOpen(): boolean {
  return opened;
}

export function initModelHelp(): void {
  viewEl = $("modelView");
  bodyEl = $("modelBody");
  $("menuModel").addEventListener("click", openModel);
  $("btnModelClose").addEventListener("click", closeModel);
  document.addEventListener(
    "keydown",
    (e) => {
      if (opened && e.key === "Escape") {
        e.stopPropagation();
        closeModel();
      }
    },
    true,
  );
}

export function openModel(): void {
  bodyEl.innerHTML = buildModel();
  viewEl.hidden = false;
  opened = true;
  releaseTrap = trapFocus(viewEl);
  $<HTMLButtonElement>("btnModelClose").focus();
}

function closeModel(): void {
  opened = false;
  releaseTrap?.();
  releaseTrap = null;
  viewEl.hidden = true;
  $<HTMLButtonElement>("menuModel").focus();
}

/** Lista de <li> a partir de un prefijo de clave i18n con n elementos. */
function list(prefix: string, n: number): string {
  const items: string[] = [];
  for (let i = 1; i <= n; i++) items.push(`<li>${t(`${prefix}.${i}`)}</li>`);
  return `<ul>${items.join("")}</ul>`;
}

function section(titleKey: string, bodyKey: string): string {
  return `<h3>${t(titleKey)}</h3><p>${t(bodyKey)}</p>`;
}

function buildModel(): string {
  return (
    `<div class="model-doc">` +
    `<p>${t("model.intro")}</p>` +
    section("model.s1.title", "model.s1.body") +
    `<h3>${t("model.s2.title")}</h3>${list("model.s2.item", 4)}` +
    `<h3>${t("model.s3.title")}</h3>${list("model.s3.item", 5)}` +
    section("model.s4.title", "model.s4.body") +
    `<h3>${t("model.s5.title")}</h3><p>${t("model.s5.body")}</p>${list("model.s5.item", 4)}` +
    `<h3>${t("model.limitsTitle")}</h3>${list("model.lim", 6)}` +
    section("model.validationTitle", "model.validationBody") +
    `<div class="model-note">${t("rp.disclaimer")}</div>` +
    `</div>`
  );
}
