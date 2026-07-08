// ============================================================================
// UI — Barrido · sweep analysis para tranvías
// ============================================================================
"use strict";

const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (x, d = 3) => (x == null || !isFinite(x)) ? "—" : x.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

const state = {
  vehicle: clone(VEHICLE_PRESETS[0].vehicle),
  kin: defaultKin(),
  obstacles: null, obstaclesName: "", clash: null,
  uic: { enabled: false, a: 13.9, na: 2.3, p: 1.85, b: 1.325 },
  track: null, trackName: "", trackLen: 0,
  sweep: null, playIdx: 0, playing: false, calcMs: 0,
  view: { scale: 8, ox: 0, oy: 0 },
};

// ------------------------------------------------------------ panel rótulas
function renderJointsPanel() {
  const v = state.vehicle;
  syncJoints(v);
  const wrap = $("joints");
  wrap.innerHTML = "";
  v.joints.forEach((j, i) => {
    const a = v.modules[i], b = v.modules[i + 1];
    const card = document.createElement("div");
    card.className = "joint" + (j.type === "rigida" ? " rigida" : (j.type === "bisectriz" ? " bisectriz" : ""));
    card.innerHTML = `
      <div class="head"><b>R${i + 1} · ${a.id || "M" + (i + 1)} ↔ ${b.id || "M" + (i + 2)}</b>
        <select data-f="type">
          <option value="libre" ${j.type === "libre" ? "selected" : ""}>libre</option>
          <option value="rigida" ${j.type === "rigida" ? "selected" : ""}>rígida</option>
          <option value="bisectriz" ${j.type === "bisectriz" ? "selected" : ""}>bisectriz</option>
        </select>
      </div>
      <div class="fields">
        <div class="f"><label>HUECO TESTEROS m</label><input type="number" step="0.05" min="0" value="${j.gap}" data-f="gap"></div>
        <div class="f"><label>ANCHO FUELLE m</label><input type="number" step="0.05" min="0.5" value="${j.fuelleWidth}" data-f="fuelleWidth"></div>
        <div class="f"><label>LÍMITE GIRO °</label><input type="number" step="1" min="0" value="${j.maxAngleDeg}" data-f="maxAngleDeg"></div>
      </div>
      ${j.type === "bisectriz" ? `<div class="fields" style="margin-top:6px">
        <div class="f"><label>RIGIDEZ BIELAS / CAJA-BOGIE [–]</label><input type="number" step="1" min="0.1" value="${j.stiffness || 10}" data-f="stiffness"></div>
        <div></div><div></div>
      </div>` : ""}`;
    card.querySelectorAll("input,select").forEach(el => {
      el.addEventListener("change", () => {
        const f = el.dataset.f;
        j[f] = f === "type" ? el.value : (parseFloat(el.value) || 0);
        if (f === "type") renderJointsPanel();
      });
    });
    wrap.appendChild(card);
  });
}

// ------------------------------------------------------------ panel vehículo
function renderVehiclePanel() {
  const v = state.vehicle;
  $("wheelbase").value = v.wheelbase;
  $("mirEnabled").checked = !!(v.mirror && v.mirror.enabled);
  $("mirProt").value = v.mirror ? v.mirror.protrusion : 0.25;
  $("mirOff").value = v.mirror ? v.mirror.offsetFromFront : 0.55;

  const wrap = $("modules");
  wrap.innerHTML = "";
  v.modules.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "mod" + (m.type === "bogie" ? "" : " susp");
    const isBogie = m.type === "bogie";
    card.innerHTML = `
      <div class="head">
        <input value="${m.id || "M" + (i + 1)}" data-f="id" title="Identificador">
        <select data-f="type">
          <option value="bogie" ${isBogie ? "selected" : ""}>bogie</option>
          <option value="suspendido" ${!isBogie ? "selected" : ""}>suspendido</option>
        </select>
        <div class="tools">
          <button data-a="up" title="Subir">↑</button>
          <button data-a="down" title="Bajar">↓</button>
          <button data-a="dup" title="Duplicar">⧉</button>
          <button data-a="del" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="fields">
        <div class="f"><label>LONGITUD m</label><input type="number" step="0.05" min="0.5" value="${m.length}" data-f="length"></div>
        <div class="f"><label>ANCHO m</label><input type="number" step="0.01" min="1" value="${m.width}" data-f="width"></div>
        ${isBogie ? `<div class="f"><label>PIVOTE↦FRENTE m</label><input type="number" step="0.05" min="0" value="${m.pivotFromFront}" data-f="pivotFromFront"></div>` : `<div></div>`}
      </div>
      ${isBogie ? `<div class="fields" style="margin-top:6px">
        <div class="f"><label>TIPO BOGIE</label><select data-f="bogieType">
          <option value="pivotante" ${(m.bogieType || "pivotante") === "pivotante" ? "selected" : ""}>pivotante</option>
          <option value="rigido" ${m.bogieType === "rigido" ? "selected" : ""}>rígido</option>
        </select></div>
        <div class="f"><label>EMPATE m (vacío=global)</label><input type="number" step="0.05" min="0.5" value="${m.wheelbase || ""}" placeholder="${state.vehicle.wheelbase}" data-f="wheelbase"></div>
        <div></div>
      </div>
      <div class="fields" style="margin-top:6px">
        <div class="f"><label>ART. DELANT. ↦frente m</label><input type="number" step="0.05" min="0" value="${m.jointFrontOff || 0}" data-f="jointFrontOff"></div>
        <div class="f"><label>ART. TRASERA ↦testero m</label><input type="number" step="0.05" min="0" value="${m.jointRearOff || 0}" data-f="jointRearOff"></div>
        <div></div>
      </div>` : ""}`;
    card.querySelectorAll("input,select").forEach(el => {
      el.addEventListener("change", () => {
        const f = el.dataset.f;
        if (f === "id") m.id = el.value;
        else if (f === "type") { m.type = el.value; if (m.type === "bogie" && m.pivotFromFront == null) m.pivotFromFront = m.length / 2; renderVehiclePanel(); }
        else if (f === "bogieType") m.bogieType = el.value;
        else if (f === "wheelbase") m.wheelbase = el.value === "" ? null : (parseFloat(el.value) || null);
        else m[f] = parseFloat(el.value) || 0;
      });
    });
    card.querySelectorAll(".tools button").forEach(btn => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.a;
        if (a === "del" && v.modules.length > 1) v.modules.splice(i, 1);
        if (a === "dup") v.modules.splice(i + 1, 0, clone(m));
        if (a === "up" && i > 0) { v.modules.splice(i, 1); v.modules.splice(i - 1, 0, m); }
        if (a === "down" && i < v.modules.length - 1) { v.modules.splice(i, 1); v.modules.splice(i + 1, 0, m); }
        renderVehiclePanel();
      });
    });
    wrap.appendChild(card);
  });
  renderJointsPanel();
}

$("wheelbase").addEventListener("change", e => state.vehicle.wheelbase = parseFloat(e.target.value) || 1.8);
for (const [id, f] of [["mirEnabled", "enabled"], ["mirProt", "protrusion"], ["mirOff", "offsetFromFront"]]) {
  $(id).addEventListener("change", e => {
    if (!state.vehicle.mirror) state.vehicle.mirror = { enabled: false, protrusion: 0.25, length: 0.30, offsetFromFront: 0.55 };
    state.vehicle.mirror[f] = f === "enabled" ? e.target.checked : (parseFloat(e.target.value) || 0);
  });
}
// ------------------------------------------------------------ panel cinemática
const KIN_MM = ["dMax", "iMax", "q", "tAlign", "tCant"]; // campos mostrados en mm
function renderKinPanel() {
  const k = state.kin;
  $("kinEnabled").checked = !!k.enabled;
  $("kinFields").style.display = k.enabled ? "block" : "none";
  for (const f of ["h", "e", "dMax", "rFull", "iMax", "sigma", "hRoll", "q", "tAlign", "tCant"]) {
    const el = $("kin_" + f);
    el.value = KIN_MM.includes(f) ? Math.round(k[f] * 1000) : k[f];
  }
  $("kin_stopped").checked = !!k.stopped;
}
$("kinEnabled").addEventListener("change", e => { state.kin.enabled = e.target.checked; renderKinPanel(); run(); });
$("kin_stopped").addEventListener("change", e => { state.kin.stopped = e.target.checked; run(); });
for (const f of ["h", "e", "dMax", "rFull", "iMax", "sigma", "hRoll", "q", "tAlign", "tCant"]) {
  $("kin_" + f).addEventListener("change", e => {
    const val = parseFloat(e.target.value) || 0;
    state.kin[f] = KIN_MM.includes(f) ? val / 1000 : val;
    run();
  });
}

// ------------------------------------------------------------ obstáculos
$("btnObs").addEventListener("click", () => $("fileObs").click());
$("fileObs").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const { obstacles, warnings } = obstaclesFromDXF(await f.text());
    if (!obstacles.length) throw new Error("sin geometría importable");
    state.obstacles = obstacles; state.obstaclesName = f.name;
    $("obsInfo").textContent = `${f.name} · ${obstacles.length} entidad(es)` + (warnings.length ? " · " + warnings.join(" ") : "");
    $("btnObsClear").style.display = "inline-block";
    run();
  } catch (err) { $("obsInfo").textContent = "No se pudo importar: " + err.message; }
  e.target.value = "";
});
$("btnObsClear").addEventListener("click", () => {
  state.obstacles = null; state.clash = null; state.obstaclesName = "";
  $("obsInfo").textContent = ""; $("btnObsClear").style.display = "none"; run();
});
$("reqMargin").addEventListener("change", run);

// ------------------------------------------------------------ peralte real
$("btnCant").addEventListener("click", () => $("fileCant").click());
$("fileCant").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const table = parseCantCSV(await f.text());
  if (!table) { $("cantInfo").textContent = "CSV no válido (se esperan líneas pk;D_mm)."; }
  else {
    state.kin.cantTable = table;
    $("cantInfo").textContent = `${f.name} · ${table.length} puntos · PK ${fmt(table[0][0],1)}–${fmt(table[table.length-1][0],1)} (sustituye a la ley por curvatura — pulsa para quitar)`;
    $("cantInfo").style.cursor = "pointer";
    $("cantInfo").onclick = () => { state.kin.cantTable = null; $("cantInfo").textContent = ""; run(); };
    run();
  }
  e.target.value = "";
});

// ------------------------------------------------------------ panel UIC 505
function renderUicPanel() {
  $("uicEnabled").checked = !!state.uic.enabled;
  $("uicFields").style.display = state.uic.enabled ? "block" : "none";
  for (const f of ["a", "na", "p", "b"]) $("uic_" + f).value = state.uic[f];
}
$("uicEnabled").addEventListener("change", e => {
  state.uic.enabled = e.target.checked;
  if (state.uic.enabled) Object.assign(state.uic, uicParamsFromVehicle(state.vehicle));
  renderUicPanel(); drawProfile(); renderCartouche();
});
$("btnUicAuto").addEventListener("click", () => {
  Object.assign(state.uic, uicParamsFromVehicle(state.vehicle));
  renderUicPanel(); drawProfile(); renderCartouche();
});
for (const f of ["a", "na", "p", "b"]) {
  $("uic_" + f).addEventListener("change", e => {
    state.uic[f] = parseFloat(e.target.value) || 0;
    drawProfile(); renderCartouche();
  });
}
function uicRows() {
  if (!state.uic.enabled || !state.sweep) return null;
  return uic505Profile(state.track, state.uic, state.sweep.rows);
}

$("btnAddMod").addEventListener("click", () => {
  state.vehicle.modules.push({ id: "M" + (state.vehicle.modules.length + 1), type: "suspendido", length: 5.5, width: 2.65 });
  renderVehiclePanel();
});

VEHICLE_PRESETS.forEach((p, i) => $("vehPreset").add(new Option(p.name, i)));
$("vehPreset").addEventListener("change", e => {
  state.vehicle = clone(VEHICLE_PRESETS[+e.target.value].vehicle);
  renderVehiclePanel(); run();
});

// JSON import/export de vehículo
$("btnExportVehJson").addEventListener("click", () =>
  download("vehiculo.json", JSON.stringify(state.vehicle, null, 2), "application/json"));
$("btnImportVehJson").addEventListener("click", () => $("fileVehJson").click());
$("fileVehJson").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const v = JSON.parse(await f.text());
    if (!Array.isArray(v.modules)) throw new Error("El JSON no tiene lista de módulos.");
    state.vehicle = v; renderVehiclePanel(); run();
  } catch (err) { $("vehErrors").textContent = "JSON no válido: " + err.message; }
  e.target.value = "";
});

// ------------------------------------------------------------ panel trazado
TRACK_PRESETS.forEach((p, i) => $("trackPreset").add(new Option(p.name, i)));
function loadPreset(i) {
  state.track = TRACK_PRESETS[i].build();
  state.trackName = TRACK_PRESETS[i].name;
  $("trackInfo").textContent = `${state.trackName} · L = ${fmt(state.track.length, 2)} m`;
  $("trackWarnings").textContent = "";
}
$("trackPreset").addEventListener("change", e => { loadPreset(+e.target.value); run(); });

$("btnDxf").addEventListener("click", () => $("fileDxf").click());
$("fileDxf").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const { chains, warnings } = parseDXF(await f.text());
    const { points, warnings: w2 } = joinChains(chains);
    const all = warnings.concat(w2);
    if (!points || points.length < 2) throw new Error(all.join(" ") || "Sin geometría importable.");
    state.track = trackFromPoints(points);
    state.trackName = f.name;
    $("trackInfo").textContent = `${f.name} · ${chains.length} entidad(es) · L = ${fmt(state.track.length, 2)} m`;
    $("trackWarnings").textContent = all.join(" ");
    $("trackPreset").selectedIndex = -1;
    run();
  } catch (err) {
    $("trackWarnings").textContent = "";
    $("trackInfo").textContent = "";
    setStatus("No se pudo importar el DXF: " + err.message, true);
  }
  e.target.value = "";
});

// ------------------------------------------------------------ cálculo
function setStatus(msg, isErr) {
  const el = $("status");
  el.textContent = msg; el.className = isErr ? "error" : "";
  el.style.display = msg ? "block" : "none";
}

function run() {
  stopPlay();
  const errs = validateVehicle(state.vehicle);
  $("vehErrors").textContent = errs.join(" · ");
  if (errs.length || !state.track) return;
  // cabinas automáticas en extremos
  state.vehicle.modules.forEach((m, i) => {
    m.cabFront = i === 0; m.cabRear = i === state.vehicle.modules.length - 1;
  });
  setStatus(hasBisectriz(state.vehicle) ? "Calculando… (equilibrio de bielas de centrado, puede tardar unos segundos)" : "Calculando…");
  setTimeout(() => {
    const t0 = performance.now();
    const sw = runSweep(state.track, state.vehicle,
      { step: parseFloat($("simStep").value) || 0.25, kin: state.kin });
    state.calcMs = performance.now() - t0;
    if (sw.error) { state.sweep = null; setStatus(sw.error, true); drawAll(); renderCartouche(); return; }
    state.sweep = sw; state.playIdx = 0;
    $("scrub").max = sw.steps.length - 1; $("scrub").value = 0;
    $("btnDxfOut").disabled = $("btnCsvOut").disabled = false;
    state.clash = state.obstacles
      ? clashCheck(state.track, sw, state.obstacles, (parseFloat($("reqMargin").value) || 0) / 1000)
      : null;
    $("btnClashOut").style.display = state.clash ? "inline-block" : "none";
    $("btnClashOut").disabled = !state.clash;
    setStatus("");
    fitView(); drawAll(); renderCartouche();
  }, 15);
}
$("btnRun").addEventListener("click", run);
$("simStep").addEventListener("change", run);

// ------------------------------------------------------------ viewport
const vp = $("viewport"), vpx = vp.getContext("2d");
function resizeCanvas(c) {
  const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
}
new ResizeObserver(() => { resizeCanvas(vp); resizeCanvas(pf); drawAll(); }).observe(vp);

function W2S(p) { // mundo -> pantalla (y invertida)
  const v = state.view, dpr = window.devicePixelRatio || 1;
  return [(p[0] * v.scale + v.ox) * dpr, (-p[1] * v.scale + v.oy) * dpr];
}
function fitView() {
  if (!state.track) return;
  resizeCanvas(vp);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const upd = (p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); };
  for (let s = 0; s <= state.track.length; s += 1) upd(state.track.pos(s));
  if (state.sweep) for (const [, r, l, k, rk, lk] of state.sweep.rows) {
    const st = state.sweep.stations;
    const lo = state.sweep.summary.kinEnabled ? rk : r, hi = state.sweep.summary.kinEnabled ? lk : l;
    upd([st.stX[k] + hi * st.stNx[k], st.stY[k] + hi * st.stNy[k]]);
    upd([st.stX[k] + lo * st.stNx[k], st.stY[k] + lo * st.stNy[k]]);
  }
  const dpr = window.devicePixelRatio || 1;
  const w = vp.width / dpr, h = vp.height / dpr, m = 40;
  const sc = Math.min((w - 2 * m) / Math.max(1e-6, x1 - x0), (h - 2 * m) / Math.max(1e-6, y1 - y0));
  state.view.scale = sc;
  state.view.ox = w / 2 - sc * (x0 + x1) / 2;
  state.view.oy = h / 2 + sc * (y0 + y1) / 2;
}
$("btnFit").addEventListener("click", () => { fitView(); drawAll(); });

let dragging = null;
vp.addEventListener("mousedown", e => dragging = [e.clientX, e.clientY]);
window.addEventListener("mousemove", e => {
  if (!dragging) return;
  state.view.ox += e.clientX - dragging[0]; state.view.oy += e.clientY - dragging[1];
  dragging = [e.clientX, e.clientY]; drawViewport();
});
window.addEventListener("mouseup", () => dragging = null);
vp.addEventListener("wheel", e => {
  e.preventDefault();
  const r = vp.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const f = e.deltaY < 0 ? 1.15 : 1 / 1.15, v = state.view;
  v.ox = mx - f * (mx - v.ox); v.oy = my - f * (my - v.oy); v.scale *= f;
  drawViewport();
}, { passive: false });

function drawViewport() {
  resizeCanvas(vp);
  const dpr = window.devicePixelRatio || 1;
  vpx.clearRect(0, 0, vp.width, vp.height);
  if (!state.track) return;
  const sw = state.sweep;

  // banda de envolvente cinemática (si está activa) — debajo de la geométrica
  if (sw && sw.summary.kinEnabled) {
    const st = sw.stations;
    vpx.beginPath();
    sw.rows.forEach(([, , , k, , lk], i) => {
      const p = W2S([st.stX[k] + lk * st.stNx[k], st.stY[k] + lk * st.stNy[k]]);
      i ? vpx.lineTo(p[0], p[1]) : vpx.moveTo(p[0], p[1]);
    });
    for (let i = sw.rows.length - 1; i >= 0; i--) {
      const [, , , k, rk] = sw.rows[i];
      const p = W2S([st.stX[k] + rk * st.stNx[k], st.stY[k] + rk * st.stNy[k]]);
      vpx.lineTo(p[0], p[1]);
    }
    vpx.closePath();
    vpx.fillStyle = "rgba(245,166,35,.13)"; vpx.fill();
    vpx.setLineDash([5 * dpr, 4 * dpr]);
    vpx.strokeStyle = "#f5a623"; vpx.lineWidth = 1.1 * dpr; vpx.stroke();
    vpx.setLineDash([]);
  }

  // banda de huella
  if (sw) {
    vpx.beginPath();
    const st = sw.stations;
    sw.rows.forEach(([, r, l, k], i) => {
      const p = W2S([st.stX[k] + l * st.stNx[k], st.stY[k] + l * st.stNy[k]]);
      i ? vpx.lineTo(p[0], p[1]) : vpx.moveTo(p[0], p[1]);
    });
    for (let i = sw.rows.length - 1; i >= 0; i--) {
      const [, r, , k] = sw.rows[i];
      const p = W2S([st.stX[k] + r * st.stNx[k], st.stY[k] + r * st.stNy[k]]);
      vpx.lineTo(p[0], p[1]);
    }
    vpx.closePath();
    vpx.fillStyle = "rgba(239,83,80,.22)"; vpx.fill();
    vpx.strokeStyle = "#ef5350"; vpx.lineWidth = 1.2 * dpr; vpx.stroke();
  }

  // eje de vía
  vpx.beginPath();
  const N = Math.max(2, Math.ceil(state.track.length / 0.5));
  for (let i = 0; i <= N; i++) {
    const p = W2S(state.track.pos(state.track.length * i / N));
    i ? vpx.lineTo(p[0], p[1]) : vpx.moveTo(p[0], p[1]);
  }
  vpx.setLineDash([6 * dpr, 5 * dpr]);
  vpx.strokeStyle = "#8b98a6"; vpx.lineWidth = 1.1 * dpr; vpx.stroke();
  vpx.setLineDash([]);
  // marca de inicio
  const p0 = W2S(state.track.pos(0));
  vpx.fillStyle = "#57b26a"; vpx.beginPath(); vpx.arc(p0[0], p0[1], 4 * dpr, 0, 7); vpx.fill();

  // obstáculos y clash
  if (state.obstacles) {
    vpx.strokeStyle = "#e7ecf2"; vpx.lineWidth = 1.6 * dpr;
    for (const chain of state.obstacles) {
      if (chain.length === 1) {
        const p = W2S(chain[0]);
        vpx.beginPath(); vpx.arc(p[0], p[1], 3 * dpr, 0, 7); vpx.stroke();
        continue;
      }
      vpx.beginPath();
      chain.forEach((pt, i) => { const p = W2S(pt); i ? vpx.lineTo(p[0], p[1]) : vpx.moveTo(p[0], p[1]); });
      vpx.stroke();
    }
    const uicP = uicRows();
  if (uicP) {
    let uL = -1e9, uR = 1e9;
    for (const [r2, l2] of uicP) { if (l2 > uL) uL = l2; if (r2 < uR) uR = r2; }
    rows.push(["UIC 505-1 equiv. int/ext", `${fmt(Math.max(uL, -uR))} / ${fmt(Math.min(uL, -uR))} m`]);
    rows.push(["Δ UIC − simulado (geo)", `<span class="v amber">${fmt((uL - uR) - s.totalWidth)} m</span> (ahorro por articulación)`]);
  }
  if (state.clash) {
      vpx.fillStyle = "#ef5350";
      for (const v of state.clash.violations) {
        const p = W2S([v.x, v.y]);
        vpx.beginPath(); vpx.arc(p[0], p[1], 4 * dpr, 0, 7); vpx.fill();
      }
      if (state.clash.minAt) {
        const p = W2S([state.clash.minAt.x, state.clash.minAt.y]);
        vpx.strokeStyle = state.clash.minMargin < state.clash.requiredMargin ? "#ef5350" : "#57b26a";
        vpx.lineWidth = 1.4 * dpr;
        vpx.beginPath(); vpx.arc(p[0], p[1], 9 * dpr, 0, 7); vpx.stroke();
        vpx.font = `${10 * dpr}px 'IBM Plex Mono',monospace`;
        vpx.fillStyle = vpx.strokeStyle;
        vpx.fillText((state.clash.minMargin * 1000).toFixed(0) + " mm", p[0] + 12 * dpr, p[1] - 8 * dpr);
      }
    }
  }

  // vehículo en la posición actual
  if (sw && sw.steps.length) {
    const stp = sw.steps[Math.min(state.playIdx, sw.steps.length - 1)];
    const styles = {
      fuelle: ["rgba(139,152,166,.30)", "#8b98a6"],
      body:   ["rgba(79,195,220,.22)", "#4fc3dc"],
      mirror: ["rgba(79,195,220,.35)", "#4fc3dc"],
    };
    for (const kind of ["fuelle", "body", "mirror"]) {
      for (const poly of stp.polys) {
        if (poly.kind !== kind) continue;
        vpx.beginPath();
        poly.pts.forEach((pt, i) => { const p = W2S(pt); i ? vpx.lineTo(p[0], p[1]) : vpx.moveTo(p[0], p[1]); });
        vpx.closePath();
        vpx.fillStyle = styles[kind][0]; vpx.fill();
        vpx.strokeStyle = styles[kind][1]; vpx.lineWidth = 1.1 * dpr; vpx.stroke();
      }
    }
    // pivotes
    vpx.fillStyle = "#f5a623";
    for (const sp of stp.chain.sPivots) {
      const p = W2S(state.track.pos(sp));
      vpx.beginPath(); vpx.arc(p[0], p[1], 2.6 * dpr, 0, 7); vpx.fill();
    }
    // rótulas: punto + ángulo de giro instantáneo
    vpx.font = `${10 * dpr}px 'IBM Plex Mono',monospace`;
    stp.chain.jointPts.forEach((jp, k) => {
      const ang = stp.chain.jointAngles[k];
      const lim = (state.vehicle.joints[k] || {}).maxAngleDeg || 0;
      const over = lim > 0 && Math.abs(ang) > lim;
      const p = W2S(jp);
      vpx.fillStyle = over ? "#ef5350" : "#e7ecf2";
      vpx.beginPath(); vpx.arc(p[0], p[1], 2.2 * dpr, 0, 7); vpx.fill();
      const label = (ang >= 0 ? "+" : "") + ang.toFixed(1) + "°";
      const tw = vpx.measureText(label).width;
      vpx.fillStyle = "rgba(18,22,28,.82)";
      vpx.fillRect(p[0] + 6 * dpr, p[1] - 14 * dpr, tw + 8 * dpr, 13 * dpr);
      vpx.fillStyle = over ? "#ef5350" : "#e7ecf2";
      vpx.fillText(label, p[0] + 10 * dpr, p[1] - 4 * dpr);
    });
    $("pkLabel").textContent = "PK " + fmt(stp.s1, 2) + " m";
  } else $("pkLabel").textContent = "PK —";
}

// ------------------------------------------------------------ perfil
const pf = $("profile"), pfx = pf.getContext("2d");
function drawProfile() {
  resizeCanvas(pf);
  const dpr = window.devicePixelRatio || 1;
  pfx.clearRect(0, 0, pf.width, pf.height);
  const sw = state.sweep;
  if (!sw || !sw.rows.length) return;
  const W = pf.width, H = pf.height, mL = 46 * dpr, mR = 8 * dpr, mT = 8 * dpr, mB = 18 * dpr;
  const s0 = sw.rows[0][0], s1 = sw.rows[sw.rows.length - 1][0];
  let yMax = 0;
  for (const [, r, l, , rk, lk] of sw.rows)
    yMax = Math.max(yMax, Math.abs(l), Math.abs(r), Math.abs(lk || 0), Math.abs(rk || 0));
  const uicPre = uicRows();
  if (uicPre) for (const [r2, l2] of uicPre) yMax = Math.max(yMax, Math.abs(l2), Math.abs(r2));
  yMax = Math.ceil(yMax * 4) / 4 + 0.25;
  const X = s => mL + (W - mL - mR) * (s - s0) / (s1 - s0);
  const Y = v => mT + (H - mT - mB) * (1 - (v + yMax) / (2 * yMax));

  // rejilla + cero
  pfx.strokeStyle = "#2b3542"; pfx.lineWidth = 1;
  pfx.font = `${9 * dpr}px 'IBM Plex Mono',monospace`; pfx.fillStyle = "#5b6875";
  for (let v = -Math.floor(yMax); v <= yMax; v += 1) {
    pfx.beginPath(); pfx.moveTo(mL, Y(v)); pfx.lineTo(W - mR, Y(v)); pfx.stroke();
    pfx.fillText(fmt(v, 1), 6 * dpr, Y(v) + 3 * dpr);
  }
  pfx.strokeStyle = "#3a4757";
  pfx.beginPath(); pfx.moveTo(mL, Y(0)); pfx.lineTo(W - mR, Y(0)); pfx.stroke();
  for (let s = Math.ceil(s0 / 20) * 20; s <= s1; s += 20) pfx.fillText(String(s), X(s) - 8 * dpr, H - 5 * dpr);

  // referencia: semiancho de caja
  const hw = sw.summary.bodyHalfWidth;
  pfx.setLineDash([3 * dpr, 4 * dpr]); pfx.strokeStyle = "#5b6875";
  for (const v of [hw, -hw]) { pfx.beginPath(); pfx.moveTo(mL, Y(v)); pfx.lineTo(W - mR, Y(v)); pfx.stroke(); }
  pfx.setLineDash([]);

  // curvas izquierda (ámbar) / derecha (cian); cinemáticas en discontinua
  const series = sw.summary.kinEnabled
    ? [[2, "#f5a623", []], [1, "#4fc3dc", []], [5, "#f5a623", [4 * dpr, 4 * dpr]], [4, "#4fc3dc", [4 * dpr, 4 * dpr]]]
    : [[2, "#f5a623", []], [1, "#4fc3dc", []]];
  for (const [idx, color, dash] of series) {
    pfx.beginPath();
    sw.rows.forEach((row, i) => { const p = [X(row[0]), Y(row[idx])]; i ? pfx.lineTo(p[0], p[1]) : pfx.moveTo(p[0], p[1]); });
    pfx.setLineDash(dash);
    pfx.strokeStyle = color; pfx.lineWidth = 1.4 * dpr; pfx.stroke();
    pfx.setLineDash([]);
  }
  // comparacion UIC 505 (verde punteado)
  const uic = uicRows();
  if (uic) {
    for (const side of [0, 1]) {
      pfx.beginPath();
      uic.forEach((pair, i) => { const p = [X(sw.rows[i][0]), Y(pair[side])]; i ? pfx.lineTo(p[0], p[1]) : pfx.moveTo(p[0], p[1]); });
      pfx.setLineDash([2 * dpr, 3 * dpr]);
      pfx.strokeStyle = "#57b26a"; pfx.lineWidth = 1.4 * dpr; pfx.stroke();
      pfx.setLineDash([]);
    }
    pfx.fillStyle = "#57b26a";
    pfx.fillText("UIC 505", mL + 6 * dpr, mT + 10 * dpr);
  }
  pfx.fillStyle = "#f5a623"; pfx.fillText("izq", W - 34 * dpr, Y(sw.rows[sw.rows.length - 1][2]) - 4 * dpr);
  pfx.fillStyle = "#4fc3dc"; pfx.fillText("dcha", W - 38 * dpr, Y(sw.rows[sw.rows.length - 1][1]) + 10 * dpr);

  // posición actual del vehículo
  if (sw.steps.length) {
    const stp = sw.steps[Math.min(state.playIdx, sw.steps.length - 1)];
    const sRear = stp.chain.sPivots[stp.chain.sPivots.length - 1];
    pfx.fillStyle = "rgba(79,195,220,.10)";
    pfx.fillRect(X(Math.max(s0, sRear)), mT, Math.max(1, X(Math.min(s1, stp.s1)) - X(Math.max(s0, sRear))), H - mT - mB);
    pfx.strokeStyle = "#e7ecf2"; pfx.lineWidth = 1;
    pfx.beginPath(); pfx.moveTo(X(stp.s1), mT); pfx.lineTo(X(stp.s1), H - mB); pfx.stroke();
  }
}

// ------------------------------------------------------------ cajetín
function renderCartouche() {
  $("cartDate").textContent = new Date().toLocaleDateString("es-ES");
  const t = $("cartTable");
  if (!state.sweep) { t.innerHTML = `<div class="k">Sin cálculo</div><div class="v">—</div>`; return; }
  const s = state.sweep.summary, v = state.vehicle;
  const rows = [
    ["Vehículo", `${v.modules.length} módulos · ${fmt(vehicleLength(v), 2)} m`],
    ["Trazado", `${state.trackName.slice(0, 26)} · ${fmt(state.track.length, 1)} m`],
    ["Semiancho máx. izq.", `<span class="v red">${fmt(s.maxLeft)} m</span> @ PK ${fmt(s.sMaxLeft, 1)}`],
    ["Semiancho máx. dcha.", `<span class="v red">${fmt(s.maxRight)} m</span> @ PK ${fmt(s.sMaxRight, 1)}`],
    ["Ancho total barrido", `<span class="v amber">${fmt(s.totalWidth)} m</span>`],
    ["Sobreancho vs. caja", `+${fmt(s.totalWidth - 2 * s.bodyHalfWidth)} m`],
  ];
  if (s.kinEnabled) {
    rows.push(["Envolv. cinemática izq/dcha", `${fmt(s.kinMaxLeft)} / ${fmt(s.kinMaxRight)} m`]);
    rows.push(["Envolv. cinemática total", `<span class="v amber">${fmt(s.kinTotalWidth)} m</span> (+${fmt(s.kinTotalWidth - s.totalWidth)})`]);
  }
  const uicP = uicRows();
  if (uicP) {
    let uL = -1e9, uR = 1e9;
    for (const [r2, l2] of uicP) { if (l2 > uL) uL = l2; if (r2 < uR) uR = r2; }
    rows.push(["UIC 505-1 equiv. int/ext", `${fmt(Math.max(uL, -uR))} / ${fmt(Math.min(uL, -uR))} m`]);
    rows.push(["Δ UIC − simulado (geo)", `<span class="v amber">${fmt((uL - uR) - s.totalWidth)} m</span> (ahorro por articulación)`]);
  }
  if (state.clash) {
    const c = state.clash;
    const ok = c.minMargin != null && c.minMargin >= c.requiredMargin;
    rows.push([`Margen mín. a obstáculo <span style="color:var(--faint)">(env. ${c.envelope})</span>`,
      c.minMargin == null ? "sin obstáculos en rango"
        : `<span class="v ${ok ? "" : "red"}">${fmt(c.minMargin * 1000, 0)} mm</span> @ PK ${fmt(c.minAt.pk, 1)}${ok ? "" : " ⚠"}`]);
    rows.push(["Invasiones de margen", c.violations.length
      ? `<span class="v red">${c.violations.length} punto(s)</span>` : "ninguna"]);
  }
  for (const j of state.sweep.joints) {
    const cls = j.exceeded ? "red" : "";
    rows.push([`Rótula R${j.idx + 1} ${j.label} <span style="color:var(--faint)">(${j.type})</span>`,
      `<span class="v ${cls}">${fmt(j.maxAngle, 1)}°</span> @ PK ${fmt(j.pk, 1)} · lím ${fmt(j.limit, 0)}°${j.exceeded ? " ⚠" : ""}`]);
  }
  rows.push(["Pasos / tiempo", `${s.nSteps} · ${fmt(state.calcMs, 0)} ms`]);
  t.innerHTML = rows.map(([k, val]) => `<div class="k">${k}</div><div class="v">${val}</div>`).join("");
}

// ------------------------------------------------------------ reproducción
function stopPlay() { state.playing = false; $("btnPlay").textContent = "▶ Reproducir"; }
$("btnPlay").addEventListener("click", () => {
  if (!state.sweep) return;
  state.playing = !state.playing;
  $("btnPlay").textContent = state.playing ? "❚❚ Pausa" : "▶ Reproducir";
  if (state.playing) requestAnimationFrame(tick);
});
function tick() {
  if (!state.playing || !state.sweep) return;
  state.playIdx = (state.playIdx + 1) % state.sweep.steps.length;
  $("scrub").value = state.playIdx;
  drawViewport(); drawProfile();
  requestAnimationFrame(tick);
}
$("scrub").addEventListener("input", e => {
  stopPlay(); state.playIdx = +e.target.value; drawViewport(); drawProfile();
});

// ------------------------------------------------------------ exportación
function download(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$("btnDxfOut").addEventListener("click", () => {
  if (state.sweep) download("huella_barrida.dxf", writeDXF(state.track, state.sweep), "application/dxf");
});
$("btnCsvOut").addEventListener("click", () => {
  if (!state.sweep) return;
  const kinOn = state.sweep.summary.kinEnabled;
  const lines = [kinOn ? "pk_m;offset_dcha_m;offset_izq_m;ancho_m;kin_dcha_m;kin_izq_m;kin_ancho_m"
                       : "pk_m;offset_dcha_m;offset_izq_m;ancho_m"];
  for (const [s, r, l, , rk, lk] of state.sweep.rows) {
    const base = [fmt(s, 3), fmt(r, 4), fmt(l, 4), fmt(l - r, 4)];
    if (kinOn) base.push(fmt(rk, 4), fmt(lk, 4), fmt(lk - rk, 4));
    lines.push(base.map(x => x.replace(",", ".")).join(";"));
  }
  download("perfil_semianchos.csv", lines.join("\n"), "text/csv");
});

$("btnClashOut").addEventListener("click", () => {
  if (!state.clash) return;
  const lines = ["pk_m;x;y;offset_m;margen_mm;estado"];
  for (const r of state.clash.points)
    lines.push([fmt(r.pk, 2), fmt(r.x, 3), fmt(r.y, 3), fmt(r.off, 3),
      fmt(r.margin * 1000, 0), r.viol ? "INVASION" : "OK"].map(x => String(x).replace(",", ".")).join(";"));
  download("informe_galibo.csv", lines.join("\n"), "text/csv");
});

function drawAll() { drawViewport(); drawProfile(); }

// ------------------------------------------------------------ arranque
renderVehiclePanel();
renderKinPanel();
renderUicPanel();
loadPreset(0);
run();
