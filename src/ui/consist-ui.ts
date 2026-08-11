// UI de DOS TRENES ACOPLADOS (consist + enganche). Cablea la sección «Tren
// acoplado» del panel Vehículo: activar, elegir el segundo tren (preset o «igual
// que el primero») y los parámetros del enganche (tipo, longitud, ancho, ángulo).
// Solo edita `state.consist`; el barrido efectivo lo ensambla `controller.run()`
// con `buildConsist`. No toca el motor ni los valores dorados.
import { VEHICLE_PRESETS } from "../engine/index";
import type { CouplerType } from "../types";
import { $, clone } from "./dom";
import { state } from "./state";
import { run } from "./controller";
import { t } from "./i18n";

/** Refleja `state.consist` en los controles (para carga de proyecto / arranque). */
export function syncConsistPanel(): void {
  const c = state.consist;
  $<HTMLInputElement>("consistEnabled").checked = c.enabled;
  $("consistFields").style.display = c.enabled ? "block" : "none";
  $<HTMLSelectElement>("couplerType").value = c.coupler.type;
  $<HTMLInputElement>("couplerLength").value = String(c.coupler.length);
  $<HTMLInputElement>("couplerWidth").value = String(c.coupler.width);
  $<HTMLInputElement>("couplerMaxAngle").value = String(c.coupler.maxAngleDeg);
  // el select de tren B se puebla en init; el valor lo mantiene el usuario
}

export function initConsist(): void {
  // Poblar el selector del segundo tren: «igual que el primero» + presets.
  const sel = $<HTMLSelectElement>("consistTrainB");
  sel.add(new Option(t("consist.sameAsFirst"), "-1"));
  VEHICLE_PRESETS.forEach((p, i) => sel.add(new Option(p.name, String(i))));
  sel.value = "-1";

  $("consistEnabled").addEventListener("change", (e) => {
    state.consist.enabled = (e.target as HTMLInputElement).checked;
    $("consistFields").style.display = state.consist.enabled ? "block" : "none";
    run();
  });

  sel.addEventListener("change", (e) => {
    const i = +(e.target as HTMLSelectElement).value;
    state.consist.trainB = i < 0 ? null : clone(VEHICLE_PRESETS[i].vehicle);
    if (state.consist.enabled) run();
  });

  $("couplerType").addEventListener("change", (e) => {
    state.consist.coupler.type = (e.target as HTMLSelectElement).value as CouplerType;
    if (state.consist.enabled) run();
  });

  const num: ReadonlyArray<[string, "length" | "width" | "maxAngleDeg"]> = [
    ["couplerLength", "length"],
    ["couplerWidth", "width"],
    ["couplerMaxAngle", "maxAngleDeg"],
  ];
  for (const [id, field] of num) {
    $(id).addEventListener("change", (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (!Number.isNaN(v)) state.consist.coupler[field] = v;
      if (state.consist.enabled) run();
    });
  }

  syncConsistPanel();
}
