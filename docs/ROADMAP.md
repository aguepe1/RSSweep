# ROADMAP — de v0.4 a producto profesional (v1.0)

Auditoría y plan de trabajo priorizado para llevar BARRIDO de «demo madura» a
**herramienta de contra-cálculo entregable**. Complementa `docs/BACKLOG.md` (épicas
E1–E5): aquí está el estado real auditado y el orden de ejecución hacia v1.0.

Severidad: 🔴 bloquea la profesionalidad · 🟠 madurez · 🟡 pulido.

---

## 0. Estado auditado (v0.4.0)

Base sólida y **honesta**: motor TypeScript limpio (**cero `any`, sin `@ts-ignore`**),
validación analítica/dorada genuinamente fuerte, Web Worker con progreso cancelable,
import DXF/LandXML, marcha bidireccional, undo/redo, autosave+recuperación, proyecto
como fichero, i18n ES/FR/EN y la nueva UI de narrativa secuencial + editor del tren.

Épicas **E1, E2 (núcleo) y E3 mayormente entregadas.** El salto pendiente a
«profesional» se concentra en cuatro frentes: **reporting entregable (E4)**, un puñado
de **arreglos de confianza/robustez** en el motor, **gobernanza de release/CI** y
**pulido de accesibilidad/i18n**.

---

## 1. Hallazgos de la auditoría

### 1.1 Confianza y corrección del motor 🔴

- **Comentarios que sobrestiman el método.** `sweep.ts` y `envelope.ts` describen la
  envolvente como «unión booleana / E2-2 exacta», pero la implementación es proyección
  por estación (lo que `ENGINE_NOTES §3` describe con honestidad). El código induce a
  error a quien lo audite. → Corregir el texto para que coincida con §3.
- **Faltan dos guardas de regresión que el propio `ENGINE_NOTES §6` prescribe:**
  (1) el solver de equilibrio debe verificar que la **energía final < inicial** (hoy
  solo se testea un proxy de ángulo); (2) el módulo suspendido: **radio del punto medio
  ≈ media de los radios de articulación − sagitta** (el bug histórico del rumbo 180°).
  Solo se cubren indirectamente vía dorados.
- **Entrada degenerada.** `trackFromPoints`/`makeTrack` fallan o emiten NaN silencioso
  con entrada vacía / puntos coincidentes / segmento de longitud cero; `runSweep` no
  invoca `validateVehicle` (vehículo vacío → anchos `-Infinity`). Sin saneado de NaN en
  resultados.

### 1.2 Reporting entregable (E4) — el gran hueco 🔴

- **No hay vista de informe ni PDF.** `report-data.ts::buildReportData` está construido
  pero es **código muerto** (nadie lo consume); `Ctrl+P` solo abre el menú de export.
  No existe `@media print` / `@page`. Es «la joya» de la spec §7 y falta entera.
- **Sin XLSX** (E4-3). **DXF básico** (E4-2): huella + comentario, sin capas
  normalizadas, HATCH, etiquetas de PK, marcadores de invasión ni validación ezdxf en CI.
- **Cajetín solo en pantalla**, sin **hash de parámetros** (reproducibilidad) ni export
  de lámina titulada (barra de escala, marcas de PK, norte).

### 1.3 Release y CI 🟠

- `pages.yml` **despliega a producción en cada push a main sin puerta de test/lint/
  typecheck** — un build roto puede publicarse.
- **Sin fichero `LICENSE`** (README/package.json declaran MIT). **`CLAUDE.md` obsoleto**
  (aún documenta el flujo Python `build.py`/`engine.js` retirado). **Sin entrada
  `[0.4.0]`** en CHANGELOG y sin tag de release → el enlace `releases/latest` del README
  no resuelve. Runners en Node 20 (en deprecación).
- Los tests Playwright corren solo contra el **dev server**: el `dist/index.html`
  entregado nunca se abre offline (`file://`) en CI — el requisito duro no se verifica.

### 1.4 Accesibilidad e i18n 🟠

- ~5 ficheros emiten **español hardcodeado** fuera de `t()` (`cartouche.ts`,
  `controller.ts`, `project.ts`, `panels.ts`) → FR/EN ven español en runtime.
- Los `<canvas>` no tienen `aria-label`; `#status`/progreso no tienen
  `role="status"`/`aria-live`; el diálogo del editor del tren **no atrapa el foco**
  (Tab se escapa). axe solo corre en el estado por defecto.
- No se persiste el ancho de paneles; sin layout responsive/tablet.

### 1.5 Dependencias

Limpio: todo MIT permisivo, cero deps de runtime. Las 5 vulnerabilidades de `npm audit`
son **solo del toolchain de desarrollo** (vitest/vite/esbuild), no se embarcan; se
resuelven con la subida mayor a vitest@4.

---

## 2. Plan de ejecución hacia v1.0

**Definición de v1.0 «profesional» = Fase 0 + Fase 1 + Fase 2.** Resultado: una
herramienta que un ingeniero puede abrir delante de un cliente y entregar como
documento firmado.

### Fase 0 · Confianza e higiene de release (rápida, primero)

- [ ] Corregir los comentarios «unión booleana» en `sweep.ts`/`envelope.ts` (→ §3).
- [ ] Escribir las dos guardas de `§6`: energía-decreciente y radio-punto-medio suspendido.
- [ ] Guardas de entrada degenerada + saneado de NaN (`track.ts`; `runSweep` llama a
      `validateVehicle`); tests de vehículo vacío / vía vacía / un punto / coincidentes.
- [ ] Puerta de CI en `pages.yml`; añadir `LICENSE`; reescribir `CLAUDE.md`; cortar
      `CHANGELOG [0.4.0]` + tag `v0.4.0`; runners Node 20 → 22.

_AC: los dorados siguen en verde; CI bloquea un deploy roto; `releases/latest` resuelve._

### Fase 1 · Reporting entregable (la joya, E4)

- [ ] **E4-1** vista de informe HTML + `@media print`/`@page` sobre el `report-data.ts`
      existente: portada con cajetín (proyecto/autor/fecha/versión + **hash de
      parámetros**), entradas, hipótesis del modelo (texto fijo de `ENGINE_NOTES §1/§5`),
      resultados (planta SVG vectorial, diagrama de semianchos, tabla por PK), registro
      de clash, anexo UIC. **Legible en B/N (trazos discontinuos, no solo color).**
- [ ] **E4-3** XLSX (SheetJS, MIT) con test de paridad frente al CSV.
- [ ] **E4-2** DXF pro (capas normalizadas, TEXT de PK, HATCH, bloques de invasión)
      validado por script ezdxf en CI.

_AC: PDF A4 de 8–15 pp del caso demo legible en B/N; la hoja Perfil del XLSX iguala al CSV._

### Fase 2 · Confianza y accesibilidad

- [ ] Enrutar el español hardcodeado por `t()`; `aria-live`/`aria-label`; atrapar foco en
      el diálogo; extender axe a estados con el editor abierto y post-cálculo.
- [ ] **E5-3** página «Modelo» en la app (hipótesis/fórmulas/límites) y **E5-2**
      `docs/VALIDATION_PROTOCOL.md` — las piezas de «nunca fiarse a ciegas».
- [ ] Smoke test offline que abra el `dist/index.html` construido vía `file://`.

_AC: capturas de las tres locales sin fugas de español; axe limpio con el editor abierto._

### Fase 3 · Madurez (post-1.0)

- [ ] Persistir ancho/colapso de paneles; layout responsive/tablet.
- [ ] **E4-4** comparador de escenarios (vehículo A vs B sobre el mismo trazado).
- [ ] Workflow de release/tagging automatizado; remediar vulns de dev (vitest@4).

---

## 3. El techo honesto del motor (nombrarlo, no ocultarlo)

Fuera del alcance de v1.0 (definen v2), pero declarados hoy con honestidad:

- **EN 15273** completa (gálibo cinemático certificable) — hoy solo reglas cuasi-estáticas.
- **Peralte 3D** real (balanceo, superelevación en tangente, rampas de transición).
- **Multivía / desvíos / holgura vía-a-vía**; geometría de aparatos.
- **Geometría vertical** (rampas, acuerdos, gálibo vertical / catenaria / altura de andén).

Un «producto profesional» aquí significa una herramienta de **verificación** transparente
y auditable, no una certificación de gálibo. La honestidad sobre este techo es un _feature_.
