// Paneles del lateral izquierdo: vehículo, rótulas, cinemática, UIC, obstáculos,
// peralte y trazado. Renderizado + cableado de eventos. Escribe en `state` y
// dispara recálculo/redibujo mediante el controlador.
import {
  chamferContour,
  joinChains,
  obstaclesFromDXF,
  parseCantCSV,
  parseSpeedCSV,
  parseDXF,
  parseLandXML,
  syncJoints,
  trackFromPoints,
  uicParamsFromVehicle,
  TRACK_PRESETS,
  VEHICLE_PRESETS,
} from "../engine/index";
import type {
  BogieType,
  DXFParseResult,
  JointType,
  KinRules,
  Mirror,
  ModuleType,
  VehicleModule,
} from "../types";

/** Extrae la profundidad/anchura de un chaflán almacenado como contorno (E2-6);
 *  `null` si el módulo no tiene chaflán (contorno recto o ausente). */
function chamferOf(m: VehicleModule): { d: number; w: number } | null {
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
import { $, clone, download, fmt } from "./dom";
import { pkFmt } from "./pk";
import { state } from "./state";
import { run, setStatus } from "./controller";
import { drawProfile } from "./profile";
import { renderCartouche } from "./cartouche";
import { drawSchematic } from "./schematic";
import { t } from "./i18n";

// Última importación DXF industrial: se conserva para re-unir cadenas al cambiar
// la capa del eje o el sentido de marcha sin re-parsear el fichero (E2-3).
let dxfParse: DXFParseResult | null = null;
let dxfName = "";

// índice del módulo que se está arrastrando para reordenar la tabla (E3-1)
let dragSrc: number | null = null;

/** Capa de la cadena más larga (por longitud de polilínea), como propuesta de
 *  eje por defecto al importar un DXF con varias capas (E2-3). `null` si no hay
 *  metadatos de capa por cadena. */
function longestChainLayer(r: DXFParseResult): string | null {
  const layers = r.chainLayers;
  if (!layers) return null;
  let best = -1;
  let bestLayer: string | null = null;
  r.chains.forEach((ch, i) => {
    let len = 0;
    for (let k = 1; k < ch.length; k++) {
      len += Math.hypot(ch[k][0] - ch[k - 1][0], ch[k][1] - ch[k - 1][1]);
    }
    if (len > best) {
      best = len;
      bestLayer = layers[i] ?? null;
    }
  });
  return bestLayer;
}

/** Une las cadenas de la última importación DXF aplicando la capa de eje y el
 *  sentido de marcha seleccionados, fija el trazado y recalcula (E2-3). */
function applyDxf(): void {
  const r = dxfParse;
  if (!r) return;
  const layer =
    $("dxfLayerRow").style.display !== "none" ? $<HTMLSelectElement>("dxfLayer").value : undefined;
  const flip = $<HTMLInputElement>("dxfFlip").checked;
  const { points, warnings: w2 } = joinChains(r.chains, {
    layer,
    chainLayers: r.chainLayers,
    flip,
  });
  const all = r.warnings.concat(w2);
  if (!points || points.length < 2) {
    $("trackWarnings").textContent = "";
    $("trackInfo").textContent = "";
    setStatus(all.join(" ") || "Sin geometría importable en la capa elegida.", true);
    return;
  }
  state.track = trackFromPoints(points);
  state.trackName = dxfName;
  state.pkMap = null; // DXF ⇒ PK = longitud de arco (sin mapa de proyecto).
  const layerTxt = layer ? ` · capa ${layer}` : "";
  $("trackInfo").textContent =
    `${dxfName} · ${r.chains.length} entidad(es)${layerTxt} · L = ${fmt(state.track.length, 2)} m`;
  $("trackWarnings").textContent = all.join(" ");
  $<HTMLSelectElement>("trackPreset").selectedIndex = -1;
  run();
}

// campos numéricos de la cinemática mostrados en la UI
const KIN_NUM = [
  "h",
  "e",
  "dMax",
  "rFull",
  "iMax",
  "sigma",
  "hRoll",
  "q",
  "tAlign",
  "tCant",
] as const satisfies ReadonlyArray<keyof KinRules>;
// subconjunto mostrado en mm (se convierte a metros en `state`)
const KIN_MM: ReadonlyArray<string> = ["dMax", "iMax", "q", "tAlign", "tCant"];

// ------------------------------------------------------------ panel rótulas
export function renderJointsPanel(): void {
  const v = state.vehicle;
  syncJoints(v);
  const wrap = $("joints");
  wrap.innerHTML = "";
  // Resultados de giro por rótula del último barrido (para la barra de ángulo
  // máx proporcional al límite y el PK crítico). Sin barrido → columna vacía.
  const jr = state.sweep?.joints;
  const table = document.createElement("table");
  table.className = "dtable jtable";
  table.innerHTML = `<thead><tr>
    <th style="width:30px">R</th>
    <th>Módulos</th>
    <th style="width:80px">Tipo</th>
    <th style="width:42px">Hueco</th>
    <th style="width:42px">Fuelle</th>
    <th style="width:38px">Lím°</th>
    <th>Máx · PK crítico</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  v.joints.forEach((j, i) => {
    const a = v.modules[i],
      b = v.modules[i + 1];
    const res = jr ? jr.find((x) => x.idx === i) : undefined;
    const over = !!res?.exceeded;
    const frac = res && j.maxAngleDeg > 0 ? Math.min(1, res.maxAngle / j.maxAngleDeg) : 0;
    const cap = res ? `${fmt(res.maxAngle, 1)}° @ PK ${pkFmt(res.pk)}` : "—";
    const tr = document.createElement("tr");
    tr.className =
      "joint" +
      (j.type === "rigida" ? " rigida" : j.type === "bisectriz" ? " bisectriz" : "") +
      (over ? " exceeded" : "");
    tr.innerHTML = `
      <td>R${i + 1}</td>
      <td class="mut" style="text-align:left">${a.id || "M" + (i + 1)}↔${b.id || "M" + (i + 2)}</td>
      <td><select data-f="type" aria-label="Tipo de rótula R${i + 1}">
        <option value="libre" ${j.type === "libre" ? "selected" : ""}>libre</option>
        <option value="rigida" ${j.type === "rigida" ? "selected" : ""}>rígida</option>
        <option value="bisectriz" ${j.type === "bisectriz" ? "selected" : ""}>bisectriz</option>
      </select></td>
      <td><input type="number" step="0.05" min="0" value="${j.gap}" data-f="gap" aria-label="Hueco entre testeros R${i + 1} (m)"></td>
      <td><input type="number" step="0.05" min="0.5" value="${j.fuelleWidth}" data-f="fuelleWidth" aria-label="Ancho del fuelle R${i + 1} (m)"></td>
      <td><input type="number" step="1" min="0" value="${j.maxAngleDeg}" data-f="maxAngleDeg" aria-label="Límite de giro R${i + 1} (°)"></td>
      <td>
        <div class="abar${over ? " over" : ""}"><span style="width:${(frac * 100).toFixed(0)}%"></span></div>
        <div class="angcap">${cap}</div>
      </td>`;
    tr.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
      el.addEventListener("change", () => {
        const f = el.dataset.f!;
        if (f === "type") {
          j.type = el.value as JointType;
          renderJointsPanel();
        } else {
          (j as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
          if (f === "gap") drawSchematic(); // el hueco de fuelle cambia el esquema
        }
      });
    });
    tbody.appendChild(tr);
    if (j.type === "bisectriz") {
      const ext = document.createElement("tr");
      ext.className = "jext";
      ext.innerHTML = `<td></td><td colspan="6"><div class="sub">
        <label>RIGIDEZ BIELAS / CAJA-BOGIE [–]</label>
        <input type="number" step="1" min="0.1" value="${j.stiffness || 10}" data-f="stiffness" aria-label="Rigidez bielas / caja-bogie R${i + 1}">
      </div></td>`;
      ext.querySelector<HTMLInputElement>("input")!.addEventListener("change", (e) => {
        j.stiffness = parseFloat((e.target as HTMLInputElement).value) || 0;
      });
      tbody.appendChild(ext);
    }
  });
  wrap.appendChild(table);
}

// Asocia cada `<label>` de un grupo `.f` con su control (id generado) para que
// tenga nombre accesible (a11y §5), sin cambiar el marcado visible.
let afSeq = 0;
function linkFieldLabels(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".f").forEach((f) => {
    const label = f.querySelector("label");
    const ctl = f.querySelector<HTMLInputElement | HTMLSelectElement>("input,select");
    if (!label || !ctl) return;
    if (!ctl.id) ctl.id = `af${++afSeq}`;
    label.htmlFor = ctl.id;
  });
}

// ------------------------------------------------------------ panel vehículo
export function renderVehiclePanel(): void {
  const v = state.vehicle;
  $<HTMLInputElement>("wheelbase").value = String(v.wheelbase);
  $<HTMLInputElement>("mirEnabled").checked = !!(v.mirror && v.mirror.enabled);
  $<HTMLInputElement>("mirProt").value = String(v.mirror ? v.mirror.protrusion : 0.25);
  $<HTMLInputElement>("mirOff").value = String(v.mirror ? v.mirror.offsetFromFront : 0.55);

  const wrap = $("modules");
  wrap.innerHTML = "";
  const table = document.createElement("table");
  table.className = "dtable mtable";
  table.innerHTML = `<thead><tr>
    <th style="width:50px">Id</th>
    <th style="width:88px">Tipo</th>
    <th style="width:44px">Long</th>
    <th style="width:44px">Ancho</th>
    <th style="width:42px">Piv</th>
    <th style="width:74px">Testero</th>
    <th></th>
  </tr></thead>`;
  const n = v.modules.length;
  let sumLen = 0;
  v.modules.forEach((m, i) => {
    sumLen += m.length;
    const isBogie = m.type === "bogie";
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const isCab = isFirst || isLast;
    const cham = chamferOf(m);
    const tb = document.createElement("tbody");
    tb.className = "mod" + (isBogie ? "" : " susp");
    tb.dataset.idx = String(i);
    const main = document.createElement("tr");
    main.className = "mrow";
    main.innerHTML = `
      <td><input value="${m.id || "M" + (i + 1)}" data-f="id" title="Identificador" aria-label="Identificador del módulo ${i + 1}"></td>
      <td><select data-f="type" aria-label="Tipo del módulo ${i + 1}">
        <option value="bogie" ${isBogie ? "selected" : ""}>bogie</option>
        <option value="suspendido" ${!isBogie ? "selected" : ""}>suspendido</option>
      </select></td>
      <td><input type="number" step="0.05" min="0.5" value="${m.length}" data-f="length" aria-label="Longitud del módulo ${i + 1} (m)"></td>
      <td><input type="number" step="0.01" min="1" value="${m.width}" data-f="width" aria-label="Ancho del módulo ${i + 1} (m)"></td>
      <td>${isBogie ? `<input type="number" step="0.05" min="0" value="${m.pivotFromFront}" data-f="pivotFromFront" aria-label="Pivote desde el frente del módulo ${i + 1} (m)">` : `<span class="mut">—</span>`}</td>
      <td>${
        isCab
          ? `<select data-f="cabShape" aria-label="Forma del testero del módulo ${i + 1}">
        <option value="recto" ${cham ? "" : "selected"}>recto</option>
        <option value="chaflan" ${cham ? "selected" : ""}>chaflán</option>
      </select>`
          : `<span class="mut">—</span>`
      }</td>
      <td class="tools">
        <button class="handle" data-a="drag" title="Arrastrar" draggable="true">⠿</button>
        <button data-a="up" title="Subir">↑</button>
        <button data-a="down" title="Bajar">↓</button>
        <button data-a="dup" title="Duplicar">⧉</button>
        <button data-a="del" title="Eliminar">✕</button>
      </td>`;
    tb.appendChild(main);
    if (isCab && cham) {
      const rx = document.createElement("tr");
      rx.className = "modx";
      rx.innerHTML = `<td></td><td colspan="6"><div class="sub">
        <div class="f"><label>CHAFLÁN PROF. m</label><input type="number" step="0.05" min="0" value="${+cham.d.toFixed(3)}" data-f="chamD"></div>
        <div class="f"><label>CHAFLÁN ANCHO m</label><input type="number" step="0.05" min="0" value="${+cham.w.toFixed(3)}" data-f="chamW"></div>
        <div></div>
      </div></td>`;
      tb.appendChild(rx);
    }
    if (isBogie) {
      const rb = document.createElement("tr");
      rb.className = "modx";
      rb.innerHTML = `<td></td><td colspan="6"><div class="sub">
        <div class="f"><label>TIPO BOGIE</label><select data-f="bogieType">
          <option value="pivotante" ${(m.bogieType || "pivotante") === "pivotante" ? "selected" : ""}>pivotante</option>
          <option value="rigido" ${m.bogieType === "rigido" ? "selected" : ""}>rígido</option>
        </select></div>
        <div class="f"><label>EMPATE m (vacío=global)</label><input type="number" step="0.05" min="0.5" value="${m.wheelbase || ""}" placeholder="${state.vehicle.wheelbase}" data-f="wheelbase"></div>
        <div></div>
        <div class="f"><label>ART. DELANT. ↦frente m</label><input type="number" step="0.05" min="0" value="${m.jointFrontOff || 0}" data-f="jointFrontOff"></div>
        <div class="f"><label>ART. TRASERA ↦testero m</label><input type="number" step="0.05" min="0" value="${m.jointRearOff || 0}" data-f="jointRearOff"></div>
        <div></div>
      </div></td>`;
      tb.appendChild(rb);
    }
    tb.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
      el.addEventListener("change", () => {
        const f = el.dataset.f!;
        if (f === "id") m.id = el.value;
        else if (f === "type") {
          m.type = el.value as ModuleType;
          if (m.type === "bogie" && m.pivotFromFront == null) m.pivotFromFront = m.length / 2;
          renderVehiclePanel();
        } else if (f === "bogieType") m.bogieType = el.value as BogieType;
        else if (f === "wheelbase")
          m.wheelbase = el.value === "" ? undefined : parseFloat(el.value) || undefined;
        else if (f === "cabShape") {
          if (el.value === "chaflan") {
            const ex = cham || {
              d: Math.min(0.8, m.length / 2),
              w: Math.min(0.5, m.width / 2),
            };
            m.contour = chamferContour(m, ex.d, ex.w, isFirst, isLast);
          } else m.contour = undefined;
          renderVehiclePanel();
        } else if (f === "chamD" || f === "chamW") {
          const dEl = tb.querySelector<HTMLInputElement>('[data-f="chamD"]');
          const wEl = tb.querySelector<HTMLInputElement>('[data-f="chamW"]');
          const d = parseFloat(dEl?.value || "0") || 0;
          const w = parseFloat(wEl?.value || "0") || 0;
          m.contour = chamferContour(m, d, w, isFirst, isLast);
        } else {
          (m as unknown as Record<string, number>)[f] = parseFloat(el.value) || 0;
          // mantiene el chaflán proporcional al redimensionar el módulo (E2-6)
          if (cham && (f === "length" || f === "width"))
            m.contour = chamferContour(m, cham.d, cham.w, isFirst, isLast);
        }
        drawSchematic(); // el esquema a escala refleja la edición al instante
      });
    });
    tb.querySelectorAll<HTMLButtonElement>(".tools button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.a;
        if (a === "del" && v.modules.length > 1) v.modules.splice(i, 1);
        if (a === "dup") v.modules.splice(i + 1, 0, clone(m));
        if (a === "up" && i > 0) {
          v.modules.splice(i, 1);
          v.modules.splice(i - 1, 0, m);
        }
        if (a === "down" && i < v.modules.length - 1) {
          v.modules.splice(i, 1);
          v.modules.splice(i + 1, 0, m);
        }
        if (a !== "drag") renderVehiclePanel();
      });
    });
    // reordenación por arrastre del asa (handle) — mueve el módulo `i` a la
    // posición del tbody sobre el que se suelta.
    const handle = tb.querySelector<HTMLButtonElement>('.handle[data-a="drag"]')!;
    handle.addEventListener("dragstart", (e) => {
      dragSrc = i;
      e.dataTransfer?.setData("text/plain", String(i));
    });
    tb.addEventListener("dragover", (e) => {
      if (dragSrc == null || dragSrc === i) return;
      e.preventDefault();
      tb.classList.add("drag-over");
    });
    tb.addEventListener("dragleave", () => tb.classList.remove("drag-over"));
    tb.addEventListener("drop", (e) => {
      e.preventDefault();
      tb.classList.remove("drag-over");
      if (dragSrc == null || dragSrc === i) return;
      const [moved] = v.modules.splice(dragSrc, 1);
      v.modules.splice(i, 0, moved);
      dragSrc = null;
      renderVehiclePanel();
    });
    table.appendChild(tb);
  });
  const tfoot = document.createElement("tfoot");
  tfoot.innerHTML = `<tr><td colspan="7">${n} ${t("cart.modules")} · Σ longitud ${fmt(sumLen, 2)} m</td></tr>`;
  table.appendChild(tfoot);
  wrap.appendChild(table);
  linkFieldLabels(wrap); // nombres accesibles para los campos de chaflán/bogie
  drawSchematic();
  renderJointsPanel();
}

// ------------------------------------------------------------ panel cinemática
export function renderKinPanel(): void {
  const k = state.kin;
  $<HTMLInputElement>("kinEnabled").checked = !!k.enabled;
  $("kinFields").style.display = k.enabled ? "block" : "none";
  for (const f of KIN_NUM) {
    const el = $<HTMLInputElement>("kin_" + f);
    el.value = String(KIN_MM.includes(f) ? Math.round(k[f] * 1000) : k[f]);
  }
  $<HTMLInputElement>("kin_stopped").checked = !!k.stopped;
}

// ------------------------------------------------------------ panel UIC 505
export function renderUicPanel(): void {
  $<HTMLInputElement>("uicEnabled").checked = !!state.uic.enabled;
  $("uicFields").style.display = state.uic.enabled ? "block" : "none";
  for (const f of ["a", "na", "p", "b"] as const)
    $<HTMLInputElement>("uic_" + f).value = String(state.uic[f]);
}

// ------------------------------------------------------------ trazado
export function loadPreset(i: number): void {
  state.track = TRACK_PRESETS[i].build();
  state.trackName = TRACK_PRESETS[i].name;
  state.pkMap = null; // preset ⇒ PK = longitud de arco (sin mapa de proyecto).
  dxfParse = null;
  $("dxfLayerRow").style.display = "none";
  $("dxfFlipRow").style.display = "none";
  $("trackInfo").textContent = `${state.trackName} · L = ${fmt(state.track.length, 2)} m`;
  $("trackWarnings").textContent = "";
}

// ------------------------------------------------------------ cableado
export function initPanels(): void {
  linkFieldLabels(document); // asocia los campos estáticos (kin/uic) con su etiqueta
  // vehículo: empate global + espejos
  $("wheelbase").addEventListener("change", (e) => {
    state.vehicle.wheelbase = parseFloat((e.target as HTMLInputElement).value) || 1.8;
  });
  const mirFields: ReadonlyArray<[string, keyof Mirror]> = [
    ["mirEnabled", "enabled"],
    ["mirProt", "protrusion"],
    ["mirOff", "offsetFromFront"],
  ];
  for (const [id, f] of mirFields) {
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
    });
  }

  // cinemática
  $("kinEnabled").addEventListener("change", (e) => {
    state.kin.enabled = (e.target as HTMLInputElement).checked;
    renderKinPanel();
    run();
  });
  $("kin_stopped").addEventListener("change", (e) => {
    state.kin.stopped = (e.target as HTMLInputElement).checked;
    run();
  });
  for (const f of KIN_NUM) {
    $("kin_" + f).addEventListener("change", (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value) || 0;
      state.kin[f] = KIN_MM.includes(f) ? val / 1000 : val;
      run();
    });
  }

  // obstáculos
  $("btnObs").addEventListener("click", () => $<HTMLInputElement>("fileObs").click());
  $("fileObs").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const { obstacles, warnings } = obstaclesFromDXF(await f.text());
      if (!obstacles.length) throw new Error("sin geometría importable");
      state.obstacles = obstacles;
      state.obstaclesName = f.name;
      $("obsInfo").textContent =
        `${f.name} · ${obstacles.length} entidad(es)` +
        (warnings.length ? " · " + warnings.join(" ") : "");
      $("btnObsClear").style.display = "inline-block";
      run();
    } catch (err) {
      $("obsInfo").textContent = "No se pudo importar: " + (err as Error).message;
    }
    input.value = "";
  });
  $("btnObsClear").addEventListener("click", () => {
    state.obstacles = null;
    state.clash = null;
    state.obstaclesName = "";
    $("obsInfo").textContent = "";
    $("btnObsClear").style.display = "none";
    run();
  });
  $("reqMargin").addEventListener("change", run);

  // peralte real (CSV)
  $("btnCant").addEventListener("click", () => $<HTMLInputElement>("fileCant").click());
  $("fileCant").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const table = parseCantCSV(await f.text());
    if (!table) {
      $("cantInfo").textContent = "CSV no válido (se esperan líneas pk;D_mm).";
    } else {
      state.kin.cantTable = table;
      const info = $("cantInfo");
      info.textContent = `${f.name} · ${table.length} puntos · PK ${fmt(table[0][0], 1)}–${fmt(table[table.length - 1][0], 1)} (sustituye a la ley por curvatura — pulsa para quitar)`;
      info.style.cursor = "pointer";
      info.onclick = () => {
        state.kin.cantTable = undefined;
        info.textContent = "";
        run();
      };
      run();
    }
    input.value = "";
  });

  // perfil de velocidad (CSV) — insuficiencia real I(s)=B·v²·k−D (E2-7)
  $("btnSpeed").addEventListener("click", () => $<HTMLInputElement>("fileSpeed").click());
  $("fileSpeed").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const table = parseSpeedCSV(await f.text());
    if (!table) {
      $("speedInfo").textContent = "CSV no válido (se esperan líneas pk;v_kmh).";
    } else {
      state.kin.speedTable = table;
      const info = $("speedInfo");
      info.textContent = `${f.name} · ${table.length} puntos · PK ${fmt(table[0][0], 1)}–${fmt(table[table.length - 1][0], 1)} (insuficiencia real por velocidad — pulsa para quitar)`;
      info.style.cursor = "pointer";
      info.onclick = () => {
        state.kin.speedTable = undefined;
        info.textContent = "";
        run();
      };
      run();
    }
    input.value = "";
  });

  // UIC 505
  $("uicEnabled").addEventListener("change", (e) => {
    state.uic.enabled = (e.target as HTMLInputElement).checked;
    if (state.uic.enabled) Object.assign(state.uic, uicParamsFromVehicle(state.vehicle));
    renderUicPanel();
    drawProfile();
    renderCartouche();
  });
  $("btnUicAuto").addEventListener("click", () => {
    Object.assign(state.uic, uicParamsFromVehicle(state.vehicle));
    renderUicPanel();
    drawProfile();
    renderCartouche();
  });
  for (const f of ["a", "na", "p", "b"] as const) {
    $("uic_" + f).addEventListener("change", (e) => {
      state.uic[f] = parseFloat((e.target as HTMLInputElement).value) || 0;
      drawProfile();
      renderCartouche();
    });
  }

  // añadir módulo
  $("btnAddMod").addEventListener("click", () => {
    state.vehicle.modules.push({
      id: "M" + (state.vehicle.modules.length + 1),
      type: "suspendido",
      length: 5.5,
      width: 2.65,
    });
    renderVehiclePanel();
  });

  // presets de vehículo
  const vehPreset = $<HTMLSelectElement>("vehPreset");
  VEHICLE_PRESETS.forEach((p, i) => vehPreset.add(new Option(p.name, String(i))));
  vehPreset.addEventListener("change", (e) => {
    state.vehicle = clone(VEHICLE_PRESETS[+(e.target as HTMLSelectElement).value].vehicle);
    renderVehiclePanel();
    run();
  });

  // JSON import/export de vehículo
  $("btnExportVehJson").addEventListener("click", () =>
    download("vehiculo.json", JSON.stringify(state.vehicle, null, 2), "application/json"),
  );
  $("btnImportVehJson").addEventListener("click", () => $<HTMLInputElement>("fileVehJson").click());
  $("fileVehJson").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const v = JSON.parse(await f.text());
      if (!Array.isArray(v.modules)) throw new Error("El JSON no tiene lista de módulos.");
      state.vehicle = v;
      renderVehiclePanel();
      run();
    } catch (err) {
      $("vehErrors").textContent = "JSON no válido: " + (err as Error).message;
    }
    input.value = "";
  });

  // presets de trazado
  const trackPreset = $<HTMLSelectElement>("trackPreset");
  TRACK_PRESETS.forEach((p, i) => trackPreset.add(new Option(p.name, String(i))));
  trackPreset.addEventListener("change", (e) => {
    loadPreset(+(e.target as HTMLSelectElement).value);
    run();
  });

  // importar trazado DXF (industrial: SPLINE/NURBS, $INSUNITS, capa del eje, flip — E2-3)
  $("btnDxf").addEventListener("click", () => $<HTMLInputElement>("fileDxf").click());
  $("fileDxf").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const r = parseDXF(await f.text());
      if (!r.chains.length) throw new Error(r.warnings.join(" ") || "Sin geometría importable.");
      dxfParse = r;
      dxfName = f.name;
      // Poblar el selector de capa del eje y mostrar los controles solo si hay
      // más de una capa entre las que elegir. Por defecto se propone la capa de
      // la cadena más larga (heurística: el eje suele ser la polilínea mayor,
      // no la anotación), que el usuario puede corregir.
      const layers = r.layers ?? [];
      const sel = $<HTMLSelectElement>("dxfLayer");
      sel.innerHTML = layers.map((l) => `<option value="${l}">${l}</option>`).join("");
      sel.value = longestChainLayer(r) ?? layers[0] ?? "";
      const multi = layers.length > 1;
      $("dxfLayerRow").style.display = multi ? "" : "none";
      $("dxfFlipRow").style.display = "";
      $<HTMLInputElement>("dxfFlip").checked = false;
      applyDxf();
    } catch (err) {
      dxfParse = null;
      $("dxfLayerRow").style.display = "none";
      $("dxfFlipRow").style.display = "none";
      $("trackWarnings").textContent = "";
      $("trackInfo").textContent = "";
      setStatus("No se pudo importar el DXF: " + (err as Error).message, true);
    }
    input.value = "";
  });
  // Re-unir cadenas al cambiar la capa del eje o el sentido de marcha (E2-3).
  $("dxfLayer").addEventListener("change", () => applyDxf());
  $("dxfFlip").addEventListener("change", () => applyDxf());

  // importar alignment LandXML (con PK de proyecto — E2-4)
  $("btnLandxml").addEventListener("click", () => $<HTMLInputElement>("fileLandxml").click());
  $("fileLandxml").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const r = parseLandXML(await f.text());
      if (!r) throw new Error("Sin alignment ni geometría CoordGeom importable.");
      state.track = trackFromPoints(r.points);
      state.trackName = `${f.name} · ${r.name}`;
      state.pkMap = r.pkMap;
      dxfParse = null;
      $("dxfLayerRow").style.display = "none";
      $("dxfFlipRow").style.display = "none";
      const pk0 = r.pkMap[0].pk;
      $("trackInfo").textContent =
        `${f.name} · ${r.name} · L = ${fmt(state.track.length, 2)} m · PK inicio ${fmt(pk0, 1)}`;
      $("trackWarnings").textContent = r.warnings.join(" ");
      $<HTMLSelectElement>("trackPreset").selectedIndex = -1;
      run();
    } catch (err) {
      $("trackWarnings").textContent = "";
      $("trackInfo").textContent = "";
      setStatus("No se pudo importar el LandXML: " + (err as Error).message, true);
    }
    input.value = "";
  });
}
