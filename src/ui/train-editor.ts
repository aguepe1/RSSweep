// EDITOR INTERACTIVO DEL TREN (E4-B6) — overlay a pantalla completa.
//
// Dibuja el vehículo a escala en un SVG grande e interactivo: los bogies se
// arrastran a lo largo de su caja, y al pulsar una caja, un bogie o un fuelle se
// abre una ventana flotante con sus parámetros y un botón «aplicar a todos».
// Es SOLO UI sobre `state.vehicle` (los mismos campos que editan las tablas): muta
// el modelo en sitio y sincroniza llamando a `renderVehiclePanel()` (que cascada el
// mini-esquema + rótulas) y a `run()` (re-barrido). No toca el motor ni los dorados.
import { chamferContour, rectContour } from "../engine/index";
import type { Vec2, VehicleModule } from "../types";
import { $, fmt } from "./dom";
import { state } from "./state";
import { C } from "./theme";
import { t } from "./i18n";
import { run } from "./controller";
import { addDefaultModule, applyModuleTypeDefaults, renderVehiclePanel } from "./panels";

let editorEl: HTMLElement;
let canvasEl: HTMLElement;
let popEl: HTMLElement;
let opened = false;

// geometría del último render (para mapear puntero→mundo durante el arrastre)
interface Layout {
  sc: number;
  padX: number;
  viewW: number;
  x0: number[]; // abscisa global del frente de cada módulo (incluye huecos)
}
let layout: Layout | null = null;
let svgEl: SVGSVGElement | null = null;

interface DragState {
  modIdx: number;
  piv: "single" | "front" | "rear";
  moved: boolean;
  startX: number;
  startY: number;
}
let drag: DragState | null = null;

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/** ¿Está abierto el editor? Lo consultan los atajos del shell para no filtrarse. */
export function isTrainEditorOpen(): boolean {
  return opened;
}

export function initTrainEditor(): void {
  editorEl = $("trainEditor");
  canvasEl = $("trainCanvas");
  popEl = $("trainPopover");

  $("btnEditTrain").addEventListener("click", openTrainEditor);
  $("btnCloseTrain").addEventListener("click", closeTrainEditor);
  $("btnAddCaja").addEventListener("click", () => {
    addDefaultModule(state.vehicle);
    commit();
  });

  // barra: empate global y espejos
  $("teWheelbase").addEventListener("change", (e) => {
    state.vehicle.wheelbase = parseFloat((e.target as HTMLInputElement).value) || 1.8;
    commit();
  });
  const mir: ReadonlyArray<[string, "enabled" | "protrusion" | "offsetFromFront"]> = [
    ["teMirEnabled", "enabled"],
    ["teMirProt", "protrusion"],
    ["teMirOff", "offsetFromFront"],
  ];
  for (const [id, f] of mir) {
    $(id).addEventListener("change", (e) => {
      const el = e.target as HTMLInputElement;
      if (!state.vehicle.mirror)
        state.vehicle.mirror = {
          enabled: false,
          protrusion: 0.25,
          length: 0.3,
          offsetFromFront: 0.55,
        };
      if (f === "enabled") state.vehicle.mirror.enabled = el.checked;
      else
        (state.vehicle.mirror as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
      commit();
    });
  }

  // Escape cierra (captura, para ganar al cierre de menús)
  document.addEventListener(
    "keydown",
    (e) => {
      if (opened && e.key === "Escape") {
        e.stopPropagation();
        closeTrainEditor();
      }
    },
    true,
  );

  // clic fuera de la ventana flotante la cierra
  document.addEventListener("pointerdown", (e) => {
    if (!popEl || popEl.hidden) return;
    const target = e.target as Node;
    if (!popEl.contains(target) && !(target instanceof SVGElement)) hidePopover();
  });
}

export function openTrainEditor(): void {
  opened = true;
  editorEl.hidden = false;
  syncToolbar();
  renderEditor();
  $<HTMLButtonElement>("btnCloseTrain").focus();
}

export function closeTrainEditor(): void {
  opened = false;
  hidePopover();
  editorEl.hidden = true;
  $<HTMLButtonElement>("btnEditTrain").focus();
}

/** Sincroniza los controles de la barra con el estado. */
function syncToolbar(): void {
  const v = state.vehicle;
  $<HTMLInputElement>("teWheelbase").value = String(v.wheelbase);
  $<HTMLInputElement>("teMirEnabled").checked = !!(v.mirror && v.mirror.enabled);
  $<HTMLInputElement>("teMirProt").value = String(v.mirror ? v.mirror.protrusion : 0.25);
  $<HTMLInputElement>("teMirOff").value = String(v.mirror ? v.mirror.offsetFromFront : 0.55);
}

/** Muta hecho → refresca tablas, mini-esquema, rótulas y re-barre; redibuja el
 *  editor y registra un snapshot de historial. */
function commit(): void {
  renderVehiclePanel(); // tablas + mini-esquema + rótulas (+ syncJoints)
  run(); // re-barrido (worker; cancela el anterior)
  syncToolbar();
  renderEditor();
  // el arrastre y los botones programáticos no siempre disparan un `change` que
  // burbujee; lo emitimos para que el historial (undo/redo) capture el cambio.
  document.dispatchEvent(new Event("change", { bubbles: true }));
}

// -------------------------------------------------------------- render del SVG
function renderEditor(): void {
  if (!opened) return;
  const v = state.vehicle;
  const mods = v.modules;
  const joints = v.joints ?? [];
  const gap = (i: number): number => (i < mods.length - 1 ? (joints[i]?.gap ?? 0) : 0);
  const spanX = mods.reduce((a, m, i) => a + m.length + gap(i), 0) || 1;
  const maxW = Math.max(...mods.map((m) => m.width), 1);

  const avail = Math.max(360, (canvasEl.clientWidth || 900) - 48);
  const padX = 44;
  const padTop = 40;
  const padBot = 84;
  const sc = avail / spanX;
  const drawH = maxW * sc;
  const viewW = Math.round(avail + 2 * padX);
  const viewH = Math.round(drawH + padTop + padBot);
  const cy = padTop + drawH / 2;
  const X = (xg: number): number => padX + xg * sc;
  const Y = (yl: number): number => cy - yl * sc;

  const parts: string[] = [];
  const x0arr: number[] = [];
  const empSegs: { a: number; b: number }[] = [];
  let x0 = 0;

  mods.forEach((m, i) => {
    x0arr[i] = x0;
    const contour: Vec2[] = m.contour && m.contour.length >= 3 ? m.contour : rectContour(m);
    const susp = m.type === "suspendido";
    const pts = contour.map(([xl, yl]) => `${X(x0 + xl).toFixed(1)},${Y(yl).toFixed(1)}`).join(" ");
    // cuerpo de la caja (clicable → ventana de caja)
    parts.push(
      `<polygon class="te-car te-hit" data-car="${i}" points="${pts}" fill="${C.vehicleFill}" stroke="${susp ? C.fuelle : C.vehicle}" stroke-width="1.4"/>`,
    );
    parts.push(
      `<text x="${X(x0 + m.length / 2).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="${C.secondary}" pointer-events="none">${m.id || "M" + (i + 1)}</text>`,
    );

    // pivotes: biBogie → dos; bogie → uno
    const pivs: Array<{ pv: number; tag: "single" | "front" | "rear" }> =
      m.type === "biBogie"
        ? [
            { pv: m.pivotFrontFromFront ?? m.length / 3, tag: "front" },
            { pv: m.pivotRearFromFront ?? (2 * m.length) / 3, tag: "rear" },
          ]
        : m.type === "bogie"
          ? [{ pv: m.pivotFromFront ?? m.length / 2, tag: "single" }]
          : [];
    for (const { pv, tag } of pivs) {
      const pivX = x0 + pv;
      const mwb = m.wheelbase || v.wheelbase || 1.8;
      const bw = m.bogieWidth ?? state.gauge + 0.2;
      const halfG = state.gauge / 2;
      empSegs.push({ a: pivX - mwb / 2, b: pivX + mwb / 2 });
      const xa = X(pivX - mwb / 2);
      const xb = X(pivX + mwb / 2);
      // decoración (sin capturar eventos): bastidor + ejes + pivote
      parts.push(
        `<rect x="${xa.toFixed(1)}" y="${Y(bw / 2).toFixed(1)}" width="${(xb - xa).toFixed(1)}" height="${(bw * sc).toFixed(1)}" fill="none" stroke="${C.bogie}" stroke-width="1.4" pointer-events="none"/>`,
      );
      for (const ex of [xa, xb])
        parts.push(
          `<line x1="${ex.toFixed(1)}" y1="${Y(halfG).toFixed(1)}" x2="${ex.toFixed(1)}" y2="${Y(-halfG).toFixed(1)}" stroke="${C.bogie}" stroke-width="1.8" pointer-events="none"/>`,
        );
      parts.push(
        `<circle cx="${X(pivX).toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${C.vehicle}" pointer-events="none"/>`,
      );
      // zona de captura del arrastre (transparente, cubre el bastidor)
      parts.push(
        `<rect class="te-bogie te-hit" data-mod="${i}" data-piv="${tag}" x="${xa.toFixed(1)}" y="${Y(bw / 2).toFixed(1)}" width="${(xb - xa).toFixed(1)}" height="${(bw * sc).toFixed(1)}" fill="transparent"/>`,
      );
    }

    // fuelle + rótula hacia el siguiente módulo (clicable → ventana de fuelle)
    if (i < mods.length - 1) {
      const g = gap(i);
      const rear = X(x0 + m.length);
      const gw = g * sc;
      if (gw > 0.5) {
        parts.push(
          `<rect x="${rear.toFixed(1)}" y="${(cy - drawH / 2).toFixed(1)}" width="${gw.toFixed(1)}" height="${drawH.toFixed(1)}" fill="${C.fuelleFill}" stroke="${C.fuelle}" stroke-width="0.8" pointer-events="none"/>`,
        );
      }
      const jx = rear + gw / 2;
      parts.push(
        `<circle cx="${jx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="${C.ink}" pointer-events="none"/>`,
      );
      // zona de captura de la rótula (≥ 16 px de ancho para que siempre sea clicable)
      const hitW = Math.max(gw, 16);
      parts.push(
        `<rect class="te-fuelle te-hit" data-joint="${i}" x="${(jx - hitW / 2).toFixed(1)}" y="${(cy - drawH / 2).toFixed(1)}" width="${hitW.toFixed(1)}" height="${drawH.toFixed(1)}" fill="transparent"/>`,
      );
    }
    x0 += m.length + gap(i);
  });

  // cota de longitud total
  const yDim = viewH - 26;
  parts.push(
    `<line x1="${X(0).toFixed(1)}" y1="${yDim}" x2="${X(spanX).toFixed(1)}" y2="${yDim}" stroke="${C.secondary}" stroke-width="1"/>`,
    `<text x="${X(spanX / 2).toFixed(1)}" y="${yDim + 16}" text-anchor="middle" font-size="11" font-family="'IBM Plex Mono',monospace" fill="${C.ink}">${fmt(spanX, 2)} m</text>`,
  );

  layout = { sc, padX, viewW, x0: x0arr };
  const svg = `<svg width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="${t("te.title")}">${parts.join("")}</svg>`;
  canvasEl.innerHTML = svg;
  svgEl = canvasEl.querySelector("svg");
  attachSvgEvents();
}

function attachSvgEvents(): void {
  if (!svgEl) return;
  svgEl.addEventListener("pointerdown", (e) => {
    const el = (e.target as Element).closest<SVGElement>(".te-bogie");
    if (!el) return; // cajas y fuelles se abren con `click`
    e.preventDefault();
    drag = {
      modIdx: +(el.dataset.mod || "0"),
      piv: (el.dataset.piv as DragState["piv"]) || "single",
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    canvasEl.classList.add("dragging");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  });
  svgEl.addEventListener("click", (e) => {
    const joint = (e.target as Element).closest<SVGElement>("[data-joint]");
    if (joint) return openFuellePopover(+(joint.dataset.joint || "0"), e.clientX, e.clientY);
    const car = (e.target as Element).closest<SVGElement>("[data-car]");
    if (car) return openCarPopover(+(car.dataset.car || "0"), e.clientX, e.clientY);
  });
}

function onDragMove(e: PointerEvent): void {
  if (!drag || !svgEl || !layout) return;
  const rect = svgEl.getBoundingClientRect();
  const k = layout.viewW / rect.width;
  const worldX = ((e.clientX - rect.left) * k - layout.padX) / layout.sc;
  const m = state.vehicle.modules[drag.modIdx];
  const local = Math.max(0, Math.min(m.length, worldX - layout.x0[drag.modIdx]));
  if (Math.abs(e.clientX - drag.startX) > 2 || Math.abs(e.clientY - drag.startY) > 2)
    drag.moved = true;
  if (drag.piv === "single") m.pivotFromFront = r3(local);
  else if (drag.piv === "front")
    m.pivotFrontFromFront = r3(Math.min(local, (m.pivotRearFromFront ?? m.length) - 1));
  else m.pivotRearFromFront = r3(Math.max(local, (m.pivotFrontFromFront ?? 0) + 1));
  renderEditor(); // redibujo en vivo (sin re-barrer)
}

function onDragUp(): void {
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragUp);
  canvasEl.classList.remove("dragging");
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.moved) commit();
  else openBogiePopover(d.modIdx, d.startX, d.startY);
}

// ----------------------------------------------------------------- ventanas
function hidePopover(): void {
  if (popEl) popEl.hidden = true;
}

function positionPopover(x: number, y: number): void {
  popEl.hidden = false;
  const w = popEl.offsetWidth;
  const h = popEl.offsetHeight;
  let left = x + 14;
  let top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  popEl.style.left = Math.max(8, left) + "px";
  popEl.style.top = Math.max(8, top) + "px";
}

function field(label: string, inputHtml: string): string {
  return `<div class="f"><label>${label}</label>${inputHtml}</div>`;
}

function numInput(dataf: string, value: number | undefined, step = "0.05", min = "0"): string {
  const v = value == null || Number.isNaN(value) ? "" : String(value);
  return `<input type="number" step="${step}" min="${min}" value="${v}" data-f="${dataf}">`;
}

function openBogiePopover(idx: number, x: number, y: number): void {
  const m = state.vehicle.modules[idx];
  if (m.type !== "bogie" && m.type !== "biBogie") return;
  const global = state.vehicle.wheelbase;
  const pivRows =
    m.type === "biBogie"
      ? field(t("te.bogie.pivotFront"), numInput("pivotFrontFromFront", m.pivotFrontFromFront)) +
        field(t("te.bogie.pivotRear"), numInput("pivotRearFromFront", m.pivotRearFromFront))
      : field(t("te.bogie.pivot"), numInput("pivotFromFront", m.pivotFromFront));
  const typeRow =
    m.type === "bogie"
      ? field(
          t("te.bogie.type"),
          `<select data-f="bogieType">
            <option value="pivotante" ${m.bogieType !== "rigido" ? "selected" : ""}>pivotante</option>
            <option value="rigido" ${m.bogieType === "rigido" ? "selected" : ""}>rígido</option>
          </select>`,
        )
      : "";
  popEl.innerHTML =
    `<h3>${t("te.bogie.title")} · ${m.id || "M" + (idx + 1)}</h3>` +
    field(
      t("te.bogie.wheelbase"),
      `<input type="number" step="0.05" min="0.5" value="${m.wheelbase ?? ""}" placeholder="${global}" data-f="wheelbase">`,
    ) +
    field(
      t("te.bogie.width"),
      `<input type="number" step="0.05" min="0.5" value="${m.bogieWidth ?? ""}" placeholder="${r3(state.gauge + 0.2)}" data-f="bogieWidth">`,
    ) +
    typeRow +
    pivRows +
    `<div class="pop-actions"><button class="btn small" data-a="applyBogies">${t("te.bogie.applyAll")}</button></div>`;

  popEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
    el.addEventListener("change", () => {
      const f = el.dataset.f!;
      if (f === "wheelbase" || f === "bogieWidth")
        (m as unknown as Record<string, number | undefined>)[f] =
          el.value === "" ? undefined : parseFloat(el.value) || undefined;
      else if (f === "bogieType")
        m.bogieType = (el as HTMLSelectElement).value === "rigido" ? "rigido" : undefined;
      else (m as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
      commit();
      // sin campos estructurales: no se reconstruye la ventana (evita perder foco
      // y desenganchar el botón «aplicar a todos» a mitad de un clic).
    });
  });
  popEl
    .querySelector<HTMLButtonElement>('[data-a="applyBogies"]')!
    .addEventListener("click", () => {
      for (const mm of state.vehicle.modules) {
        if (mm.type === "bogie" || mm.type === "biBogie") {
          mm.wheelbase = m.wheelbase;
          mm.bogieWidth = m.bogieWidth;
          if (mm.type === "bogie") mm.bogieType = m.type === "bogie" ? m.bogieType : mm.bogieType;
        }
      }
      commit();
    });
  positionPopover(x, y);
}

function openFuellePopover(idx: number, x: number, y: number): void {
  const v = state.vehicle;
  const j = v.joints[idx];
  if (!j) return;
  const a = v.modules[idx];
  const b = v.modules[idx + 1];
  const stiffRow =
    j.type === "bisectriz"
      ? field(t("te.joint.stiffness"), numInput("stiffness", j.stiffness || 10, "1", "0.1"))
      : "";
  popEl.innerHTML =
    `<h3>${t("te.joint.title")} R${idx + 1} · ${a.id || "M" + (idx + 1)}↔${b.id || "M" + (idx + 2)}</h3>` +
    field(
      t("te.joint.type"),
      `<select data-f="type">
        <option value="libre" ${j.type === "libre" ? "selected" : ""}>libre</option>
        <option value="rigida" ${j.type === "rigida" ? "selected" : ""}>rígida</option>
        <option value="bisectriz" ${j.type === "bisectriz" ? "selected" : ""}>bisectriz</option>
      </select>`,
    ) +
    field(t("te.joint.gap"), numInput("gap", j.gap)) +
    field(t("te.joint.fuelle"), numInput("fuelleWidth", j.fuelleWidth, "0.05", "0.5")) +
    field(t("te.joint.limit"), numInput("maxAngleDeg", j.maxAngleDeg, "1", "0")) +
    stiffRow +
    `<div class="pop-actions"><button class="btn small" data-a="applyJoints">${t("te.joint.applyAll")}</button></div>`;

  popEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
    el.addEventListener("change", () => {
      const f = el.dataset.f!;
      if (f === "type") j.type = (el as HTMLSelectElement).value as typeof j.type;
      else (j as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
      commit();
      // solo el tipo altera el juego de campos (rigidez en bisectriz) → reconstruir.
      if (f === "type") openFuellePopover(idx, x, y);
    });
  });
  popEl
    .querySelector<HTMLButtonElement>('[data-a="applyJoints"]')!
    .addEventListener("click", () => {
      for (const jj of state.vehicle.joints) {
        jj.type = j.type;
        jj.gap = j.gap;
        jj.fuelleWidth = j.fuelleWidth;
        jj.maxAngleDeg = j.maxAngleDeg;
        jj.stiffness = j.stiffness;
      }
      commit();
    });
  positionPopover(x, y);
}

function openCarPopover(idx: number, x: number, y: number): void {
  const v = state.vehicle;
  const m = v.modules[idx];
  const isCab = idx === 0 || idx === v.modules.length - 1;
  const cham = chamferOfLocal(m);
  const cabRow = isCab
    ? field(
        t("te.car.cab"),
        `<select data-f="cabShape">
          <option value="recto" ${cham ? "" : "selected"}>recto</option>
          <option value="chaflan" ${cham ? "selected" : ""}>chaflán</option>
        </select>`,
      ) +
      (cham
        ? `<div class="pop-row">${field(t("te.car.chamD"), numInput("chamD", r3(cham.d)))}${field(t("te.car.chamW"), numInput("chamW", r3(cham.w)))}</div>`
        : "")
    : "";
  popEl.innerHTML =
    `<h3>${t("te.car.title")} · ${m.id || "M" + (idx + 1)}</h3>` +
    field(t("te.car.id"), `<input type="text" value="${m.id || "M" + (idx + 1)}" data-f="id">`) +
    field(
      t("te.car.type"),
      `<select data-f="type">
        <option value="bogie" ${m.type === "bogie" ? "selected" : ""}>bogie</option>
        <option value="suspendido" ${m.type === "suspendido" ? "selected" : ""}>suspendido</option>
        <option value="biBogie" ${m.type === "biBogie" ? "selected" : ""}>2 bogies</option>
      </select>`,
    ) +
    field(t("te.car.length"), numInput("length", m.length, "0.05", "0.5")) +
    field(t("te.car.width"), numInput("width", m.width, "0.01", "1")) +
    cabRow +
    `<div class="pop-actions">
      <button class="btn small" data-a="dup">${t("te.car.dup")}</button>
      <button class="btn small" data-a="del">${t("te.car.del")}</button>
    </div>
    <div class="pop-actions"><button class="btn small" data-a="applyWidth">${t("te.car.applyWidth")}</button></div>`;

  popEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
    el.addEventListener("change", () => {
      const f = el.dataset.f!;
      const first = idx === 0;
      const last = idx === v.modules.length - 1;
      if (f === "id") m.id = (el as HTMLInputElement).value;
      else if (f === "type") {
        m.type = (el as HTMLSelectElement).value as VehicleModule["type"];
        applyModuleTypeDefaults(m);
      } else if (f === "cabShape") {
        if ((el as HTMLSelectElement).value === "chaflan") {
          const ex = cham || { d: Math.min(0.8, m.length / 2), w: Math.min(0.5, m.width / 2) };
          m.contour = chamferContour(m, ex.d, ex.w, first, last);
        } else m.contour = undefined;
      } else if (f === "chamD" || f === "chamW") {
        const dEl = popEl.querySelector<HTMLInputElement>('[data-f="chamD"]');
        const wEl = popEl.querySelector<HTMLInputElement>('[data-f="chamW"]');
        m.contour = chamferContour(
          m,
          parseFloat(dEl?.value || "0") || 0,
          parseFloat(wEl?.value || "0") || 0,
          first,
          last,
        );
      } else {
        (m as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
        if (cham && (f === "length" || f === "width"))
          m.contour = chamferContour(m, cham.d, cham.w, first, last);
      }
      commit();
      // solo el testero (recto/chaflán) cambia el juego de campos → reconstruir.
      if (f === "cabShape") openCarPopover(idx, x, y);
    });
  });
  popEl.querySelector<HTMLButtonElement>('[data-a="dup"]')!.addEventListener("click", () => {
    v.modules.splice(idx + 1, 0, JSON.parse(JSON.stringify(m)));
    commit();
    hidePopover();
  });
  popEl.querySelector<HTMLButtonElement>('[data-a="del"]')!.addEventListener("click", () => {
    if (v.modules.length > 1) v.modules.splice(idx, 1);
    commit();
    hidePopover();
  });
  popEl.querySelector<HTMLButtonElement>('[data-a="applyWidth"]')!.addEventListener("click", () => {
    for (const mm of v.modules) mm.width = m.width;
    commit();
  });
  positionPopover(x, y);
}

/** Profundidad/anchura del chaflán de un módulo (misma lógica que panels.chamferOf). */
function chamferOfLocal(m: VehicleModule): { d: number; w: number } | null {
  if (!m.contour) return null;
  const hw = m.width / 2;
  const L = m.length;
  let d = 0;
  let w = 0;
  for (const [x, y] of m.contour) {
    const atFace = Math.abs(x) < 1e-6 || Math.abs(x - L) < 1e-6;
    const full = Math.abs(Math.abs(y) - hw) < 1e-6;
    if (atFace && !full) w = Math.max(w, hw - Math.abs(y));
    if (full && !atFace) d = Math.max(d, Math.min(x, L - x));
  }
  return d > 1e-6 || w > 1e-6 ? { d, w } : null;
}
