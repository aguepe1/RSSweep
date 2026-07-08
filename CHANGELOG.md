# Changelog

Todas las versiones notables de BARRIDO. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el versionado
[SemVer](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- Accesibilidad (DESIGN_SPEC §5): navegación completa por teclado con atajos
  globales centralizados en `src/ui/shortcuts.ts` —Espacio reproduce/pausa, ←→
  recorren el deslizador de PK (±10 con Mayús), F encuadra, 1–5 conmutan las capas
  huella/kin/UIC/obstáculos/vehículo, Ctrl/Cmd+S guarda y Ctrl/Cmd+P abre informes—
  que reutilizan los controles existentes disparando sus eventos (sin lógica
  duplicada) y se inhiben al escribir en campos editables. Contraste AA verificado:
  se oscurecen los tokens de texto secundario (`--faint`) y de la tinta kin
  (`--c-kin-ink`) conservando la semántica cromática de las muestras de color.
  Etiquetas asociadas a sus controles (`for`/`id`, más un enlazador automático de
  grupos `.f`) y `aria-label` en los controles generados de las tablas de módulos y
  rótulas y en el selector de idioma. `prefers-reduced-motion` desactiva la
  reproducción automática animada y anula transiciones. El atributo `lang` del
  documento se sincroniza con la locale. `@axe-core/playwright` se añade como
  dependencia de desarrollo (no se empaqueta); `e2e/a11y.spec.ts` verifica cero
  violaciones críticas/serias de axe, el `lang` dinámico y los atajos §5 (E3-6).
- Internacionalización ES/FR/EN (DESIGN_SPEC §5): selector de idioma en la barra
  de menú con diccionarios planos clave→texto (`src/ui/i18n.ts`). El español es la
  fuente de verdad —sus valores son idénticos al texto previo, de modo que la
  locale por defecto no cambia ni un byte y los tests e2e siguen verdes—; FR/EN
  reservan a ES ante claves ausentes. Los textos estáticos del shell llevan
  `data-i18n`/`data-i18n-html`/`data-i18n-title` y se reescriben con `applyI18n()`;
  los dinámicos (cajetín, tabla de módulos, barra de estado, botón reproducir/pausa)
  se re-renderizan al cambiar de idioma. El formato numérico y de fecha es por
  locale y solo de presentación: los CSV siguen exportando con punto decimal y `;`.
  La elección persiste en `localStorage`. `e2e/i18n.spec.ts` verifica el ES por
  defecto, el cambio a EN (estático + dinámico) y a FR sin desbordar el layout (E3-5).
- Deshacer/rehacer de la edición de entrada (DESIGN_SPEC §5): pila de
  instantáneas de la parte editable del estado (vehículo, cinemática, UIC,
  obstáculos) por snapshots (no por comandos), robusta frente a cualquier mutación
  de panel. Cada `change`/`click` dispara un registro diferido que solo apila si
  algo cambió (evita entradas espurias). `Ctrl/Cmd+Z` deshace, `Ctrl/Cmd+Y` o
  `Ctrl/Cmd+Shift+Z` rehace; ambos restauran, re-renderizan y recalculan. Menú
  «Edición» con Deshacer/Rehacer sincronizados (deshabilitados cuando no aplican).
  Estructura pura y testeable `src/ui/undo-stack.ts` (`UndoStack<T>` genérica) +
  cableado en `src/ui/history.ts`. `tests/undo.test.ts` verifica que 50 operaciones
  - 50 deshacer devuelven el estado inicial, el tope de histórico y la purga del
    redo; `e2e/history.spec.ts` es el smoke de Ctrl+Z/Ctrl+Y y del menú (E3-4).
- Infraestructura de build real: Vite 6 + TypeScript estricto +
  `vite-plugin-singlefile`. `npm run build` produce un único HTML autocontenido
  (~198 KB gzip) sin peticiones de red; las fuentes (Space Grotesk / IBM Plex
  Mono, subset latin woff2) se empaquetan en base64 (E1-1).
- Port del motor a TypeScript en módulos (`src/engine/*`) con tipos compartidos
  en `src/types.ts` y cero `any` en el motor (E1-2).
- Port de la UI a TypeScript en módulos (`src/ui/*`) sobre el mismo shell (E1-2).
- Suite de tests Vitest con todos los valores dorados de `docs/ENGINE_NOTES.md`
  como fixtures, más tests de propiedad y unitarios del solver (E1-3).
- Versionado SemVer: la versión aparece en la cabecera, en el cajetín de
  resultados y como metadato/comentario en todos los ficheros exportados
  (DXF, CSV de perfil, CSV de gálibo) (E1-4).
- Barrido en Web Worker: `runSweep`/`clashCheck` se ejecutan fuera del hilo de
  UI con barra de progreso real (porcentaje por PK) y cancelación; la interfaz
  ya no se congela durante cálculos pesados (bisectriz). El worker se empaqueta
  en línea (base64) para conservar el HTML único offline (E2-1).
- Envolvente maestra como contorno remapeado: `SweepResult.envelope` expone la
  cinta cerrada (+N ida / −N vuelta) de la unión de huellas por estación; el
  perfil por PK se deriva del mismo remapeo. El remapeo aísla ramas del eje
  separadas en abscisa por más que la longitud del vehículo (auto-aproximaciones
  de bucle largo). Fixture de estrés `hairpin` + `tests/fork.test.ts` (E2-2).

### Nota de alcance (E2-2)

- Se descartó la unión booleana exacta de polígonos con `polyclip-ts` (MIT):
  unión global intratable (~O(n²) con miles de cuádriláteros muy solapados) y
  errores de robustez en unión incremental. Se comprobó además que en horquillas
  de radio inviable el vehículo envuelve ambas ramas (región conexa): la unión
  booleana no separa esa doble ocupación real. El aislamiento efectivo lo aporta
  la ventana longitudinal del remapeo; para radios navegables (R≥~20 m) la
  proyección por estaciones ya es correcta. Detalle en `docs/ENGINE_NOTES §3/§5`.
- Marcha bidireccional: casilla «Analizar ambos sentidos» que resuelve el barrido
  de ida y de vuelta (eje invertido) y une ambas envolventes sobre las mismas
  estaciones. Como las huellas están en coordenadas absolutas del plano, la
  vuelta se remapea al marco de ida trasladando su abscisa efectiva
  (`s_ida = L − s_vuelta + L_veh`). El resultado expone `summary.bidirectional`
  y `rowDir` (sentido pésimo por PK); el cajetín anota cuántos PK gobierna la
  vuelta y el CSV de perfil añade la columna `sentido` (ida/vuelta). En vehículos
  y trazados simétricos la diferencia con la ida es < 2 mm. `tests/bidir.test.ts`
  y e2e de flujo (E2-5).
- Contornos de módulo: cada módulo admite un contorno 2D del cuerpo (`contour`,
  lista cerrada de puntos en el marco local) con presets rectángulo/chaflán. La
  UI ofrece testeros de cabina achaflanados (profundidad + anchura) en los módulos
  de cabecera y cola, reflejados en el esquema a escala del viewport. El contorno
  se encaja en el cuerpo dibujado `[fs, L−rs]`, de modo que el rectángulo explícito
  reproduce exactamente el barrido por defecto y un chaflán nunca aumenta el ancho.
  Un chaflán de cabina reduce el exterior del caso 2 ejes justo lo que dicta la
  geometría del vértice. `tests/contour.test.ts` y e2e de flujo (E2-6).
- Perfiles de velocidad: importador CSV `pk;v_kmh` en el panel de cinemática que
  sustituye la insuficiencia heurística (escalada por curvatura `iMax·c`) por la
  insuficiencia real `I(s) = B·v²·k − D(s)`, con `B = e/g` (peralte de equilibrio,
  `g = 9.81`). `I>0` es insuficiencia (sobreancho exterior) y `I<0` exceso
  (interior). Con una velocidad de equilibrio (I=0 en toda la curva) la envolvente
  exterior cinemática coincide con la del caso `iMax=0` global. `tests/speed.test.ts`
  y e2e de flujo (E2-7).
- Import de alignment LandXML 1.2: muestrea `CoordGeom` (Line/Curve/Spiral clotoide)
  a polilínea densa (0.05 m) y construye un `PkMap` de PK de proyecto a partir de
  `staStart` y de las ecuaciones de PK (`StaEquation`). El motor sigue trabajando en
  longitud de arco `s`; el PkMap traduce `s → PK` solo en presentación e informes
  (`pkAt`/`sAtPk` en `src/engine/landxml.ts`), de modo que perfil, clash y cajetín
  muestran el PK de proyecto (con su salto en las ecuaciones) y el CSV exporta la
  columna `pk_m` en PK de proyecto. Los presets y el import DXF reinician el PkMap
  (PK = arco). Parser XML propio sin dependencias (corre en Node y navegador).
  Fixture `demos/alignment_demo_staStart1000.landxml`, `tests/landxml.test.ts` y
  e2e de flujo (E2-4).
- DXF industrial: el importador de trazado acepta exports reales sin pre-editar.
  Muestrea entidades `SPLINE` (NURBS) por De Boor en coordenadas homogéneas
  (racional con pesos, nudos clamped por defecto); aplica `$INSUNITS` de la
  cabecera convirtiendo todas las coordenadas a metros y avisando de la escala;
  anota la capa (código 8) de cada cadena y expone la lista de capas del dibujo.
  En la UI, cuando hay más de una capa se ofrece un selector de capa del eje
  (propuesta por defecto: la cadena más larga) y una casilla para invertir el
  sentido de marcha; cambiar cualquiera de los dos re-une las cadenas
  (`joinChains` con `JoinOpts`) sin re-parsear el fichero. Fixture sintético
  estilo Civil 3D `demos/eje_civil3d_spline_mm.dxf`, `tests/dxf.test.ts` y e2e de
  flujo (E2-3).

### Cambiado

- Proyecto como fichero (DESIGN_SPEC §7): el estado editable se serializa a un
  documento `.barrido.json` versionado (`schema: 1`) con vehículo, reglas
  cinemáticas, UIC, obstáculos, encuadre y el eje como polilínea cruda (s,x,y) más
  su mapa de PK. Al abrir se reconstruye el eje con `makeTrack` —idéntico al
  worker— de modo que reproduce el cálculo bit a bit (solo el tiempo de cálculo
  wall-clock del cajetín difiere). Menú Archivo con Nuevo/Abrir/Guardar y
  arrastrar-soltar un `.json` sobre la ventana. Autosave en localStorage tras cada
  cálculo con banner de recuperación de sesión al arrancar (se captura la sesión
  previa antes de que el primer cálculo la pise). Nuevo `src/ui/project.ts` +
  `e2e/project.spec.ts` (guardar→alterar→reabrir reproduce el cajetín idéntico;
  autosave persistido; «Nuevo proyecto» restaura el preset por defecto) (E3-3).
- Viewport CAD (DESIGN_SPEC §6): el visor de planta pasa de canvas plano a
  instrumento de medición. Reglas métricas (horizontal/vertical con cotas «bonitas»
  1/2/5·10ⁿ), rejilla métrica sutil conmutable, barra de escala dinámica y marcas de
  PK cada 10 m sobre el eje con etiqueta de PK de proyecto. Readout X/Y/PK/offset bajo
  el cursor (proyección al eje más cercano, offset con signo izq +). Capas conmutables
  (huella/cinemática/UIC/obstáculos/vehículo) y fondo claro/oscuro sin alterar la
  semántica de dato. Herramienta de medición de 2 clics (tecla `M`) con snap al vértice
  del eje (< 12 px) que anota distancia y Δoffset. Sincronización de cursor viewport↔
  perfil por un `hoverS` compartido (`src/ui/vpshared.ts`, evita el import circular
  viewport↔perfil). Export del encuadre a PNG (canvas reescalado ×3 ≈ 300 dpi) y a SVG
  vectorial que reconstruye la escena con la misma proyección mundo→pantalla
  (`src/ui/viewport-export.ts`). Nuevo `e2e/viewport.spec.ts` mide una distancia
  conocida del trazado 1 con error < 1 px de snap (E3-2).
- Sistema de diseño «mesa de delineación digital» (DESIGN_SPEC §2-3): tema claro
  imprimible por defecto (papel `#FAFAF8`, tinta `#1A1D21`, hairline 1px), color de
  acción único negro, `border-radius ≤ 4px`, `tabular-nums` global y tipografía IBM
  Plex Sans (UI) + IBM Plex Mono (datos). Nuevo `src/ui/theme.ts` como única fuente
  de color: la semántica de dato (huella `#C62828`, cinemática `#B8860B`, UIC
  `#2E7D32`, vehículo `#1565C0`, fuelle `#78838F`, obstáculo/invasión) es constante
  entre temas; el fondo del viewport se puede conmutar claro/oscuro sin alterar la
  semántica. `viewport.ts` y `profile.ts` dejan de usar literales y leen de `theme.ts`
  (equivalencia semántica exacta; motor y valores dorados intactos) (E3-1 · 1A).
- Paneles de vehículo y rótulas convertidos de tarjetas a **tablas densas**
  (DESIGN_SPEC §2). La tabla de módulos (Id·Tipo·Long·Ancho·Pivote·Testero +
  filas de detalle para chaflán y bogie) admite reordenación por arrastre del asa
  además de los botones subir/bajar, y muestra una fila de totales (Σ longitud).
  La tabla de rótulas (R#·módulos·tipo·hueco·fuelle·límite·**barra de ángulo máx
  proporcional al límite + PK crítico**) marca en rojo la fila cuya rótula excede
  el giro admisible; las barras se refrescan tras cada cálculo. Se conservan los
  `id`, atributos `data-f`/`data-a` y clases `.mod`/`.joint` de los selectores e2e.
  Nuevo `e2e/redesign.spec.ts` (E3-1 · 1B).
- Esquema del vehículo a escala («pieza de confianza nº1»): nuevo `src/ui/schematic.ts`
  que dibuja en SVG la vista en planta sin deformar de la composición (siluetas de
  módulo desde `contour`/`rectContour`, pivotes de bogie, huecos de fuelle y rótulas)
  con cotas de longitud total y ancho máximo. Refleja solo `state.vehicle`, se redibuja
  en cada edición del panel de vehículo y al redimensionar el viewport, y usa los tokens
  semánticos de `theme.ts`. `e2e/redesign.spec.ts` verifica una silueta por módulo y su
  actualización al añadir uno (E3-1 · 1C).
- Layout §4 completo (DESIGN_SPEC §4): **barra de menú** (Archivo·Vehículo·Trazado·
  Cálculo·Informes·Ayuda + selector de idioma) con desplegables que delegan en los
  botones existentes; **panel de entrada en pestañas** (Vehículo/Trazado/Reglas/
  Obstáculos) que reparte las secciones sin cambiar sus `id`; tres zonas (entrada ·
  viewport · resultados) con **paneles laterales colapsables y redimensionables** por
  arrastre del gutter; el **cajetín y la tabla de rótulas** pasan al panel de resultados
  derecho; el **diagrama de semianchos** ocupa todo el ancho; y una **barra de estado**
  nueva (`#statusBarFile`/`#statusBarUnits`/`#statusBarSteps`/`#statusBarTime`/
  `#statusBarHyp`/`#statusBarVersion`) que se puebla con fichero, unidades, nº de pasos,
  tiempo de cálculo, hipótesis activas y versión. Nuevo `src/ui/layout.ts` (pestañas,
  menú, colapsado/redimensionado, barra de estado). Los 10 e2e existentes activan la
  pestaña correspondiente antes de operar controles que ahora viven tras una pestaña;
  `e2e/redesign.spec.ts` añade el smoke de pestañas, menú y barra de estado (E3-1 · 1D).

Estado previo al port: fichero HTML autocontenido generado por
`tools/build.py` a partir de `src/engine.js` + `src/ui.js`. Motor validado
numéricamente contra los casos analíticos de `docs/ENGINE_NOTES.md`.
