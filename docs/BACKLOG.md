# BACKLOG — épicas y tareas con criterios de aceptación

Prioridad: P0 = bloquea todo lo demás · P1 = núcleo profesional · P2 = madurez.
Orden recomendado: E1 → E2-1 → E3-1/2 → E4-1 → resto intercalable.
Regla transversal: **cada tarea de E2 termina con los valores dorados en verde**
(docs/ENGINE_NOTES.md §4) y cada tarea de E3/E4 con un test Playwright.

---

## E1 · Infraestructura (P0)

**E1-1 Repo + build.** Vite + TypeScript estricto + vite-plugin-singlefile.
`npm run build` produce UN html autocontenido ≤ 400 KB gzip, sin peticiones de red en
runtime (fuentes empaquetadas subset woff2; nada de Google Fonts CDN). ESLint +
Prettier. AC: la app arranca offline desde file:// en Chrome, Edge y Firefox.

**E1-2 Port a TypeScript por módulos.** `engine/` (track, dxf, vehicle, chain, sweep,
kinematic, clash, uic, report-data), `ui/` (state, panels, viewport, profile, i18n),
tipos compartidos en `types.ts` con JSON Schema exportado para vehículo y proyecto.
AC: `tsc --noEmit` limpio; cero `any` en engine/.

**E1-3 Tests.** Vitest para engine con TODOS los valores dorados como fixtures +
property tests básicos (huella simétrica en trazado simétrico con vehículo simétrico;
envolvente invariante al sentido de recorrido en trazados sin obstáculos). Playwright
para flujos: importar DXF → calcular → exportar informe. AC: `npm test` < 60 s, CI
GitHub Actions en cada push, badge en README.

**E1-4 Versionado.** SemVer + CHANGELOG.md; la versión aparece en barra de estado,
cajetín y TODOS los ficheros exportados (DXF como comentario, CSV/XLSX como metadato,
PDF en pie). AC: dos exports de versiones distintas son distinguibles a posteriori.

---

## E2 · Motor v2 (P1)

**E2-1 Web Worker.** Todo runSweep/clashCheck fuera del hilo UI, con progreso real
(porcentaje por PK) y cancelación. AC: la UI nunca se congela >100 ms; barrido
bisectriz del bucle R20 muestra barra de progreso y es cancelable.

**E2-2 Envolvente exacta.** Sustituir la proyección por estaciones por unión booleana
de polígonos (polyclip-ts o similar MIT). La salida por PK se conserva (remapeo del
contorno a estaciones) para perfil/reporting, pero la geometría maestra es el polígono.
AC: valores dorados dentro de tolerancia; nuevo test: trazado en horquilla con ramas a
3 m no contamina offsets de la rama opuesta (hoy falla — documentarlo como fixture).

**E2-3 DXF industrial.** SPLINE (muestreo NURBS), INSUNITS con conversión y aviso,
selección de capa cuando el fichero tiene varias con geometría, elección de cadena
cuando hay más de una candidata a eje (diálogo con preview), inversión de sentido de
marcha con un clic. AC: importa un export real de Civil 3D y de MicroStation (añadir
fixtures reales a demos/) sin edición previa.

**E2-4 LandXML.** Import de alignment LandXML 1.2 (Line/Curve/Spiral clotoide) con PK
de proyecto (staStart) y ecuaciones de PK si existen. Los PK de proyecto sustituyen a
la longitud de arco en TODA la app y los informes. AC: fixture LandXML con staStart
≠ 0 muestra PKs correctos en perfil, clash y cajetín.

**E2-5 Marcha bidireccional.** Checkbox "analizar ambos sentidos": ejecuta el barrido
en los dos sentidos y une envolventes (vehículos asimétricos y trazados con contracurvas
dan huellas distintas por sentido). AC: para vehículo simétrico la diferencia es < 2 mm
(test); para vehículo asimétrico el informe indica el sentido pésimo por PK.

**E2-6 Contornos de módulo.** Testeros de cabina achaflanados/curvos: contorno 2D por
módulo editable como lista de puntos (con presets rectángulo/chaflán), reflejado en el
esquema a escala del vehículo. AC: un chaflán de cabina reduce el exterior en el caso
2 ejes exactamente lo que dicta la geometría (test analítico del vértice).

**E2-7 Perfiles de velocidad (opcional P2).** CSV pk;v_kmh → insuficiencia real
I(s) = B·v²·k − D(s) en vez del escalado por c. AC: con v tal que I=0 en toda la curva,
la envolvente exterior cinemática iguala a la de I=0 global.

---

## E3 · Interfaz profesional (P1)

**E3-1 Rediseño completo** según DESIGN_SPEC (layout de menú + 3 zonas + estado,
tema claro por defecto con viewport conmutable, tablas en lugar de tarjetas, esquema
del vehículo a escala con cotas). AC: revisión visual contra la spec sección a sección;
cero violaciones de las "reglas duras" (§2 de la spec) auditadas en code review.

**E3-2 Viewport CAD.** Reglas, barra de escala, readout X/Y/PK/offset, marcas de PK,
toggles de capas, medición, export PNG/SVG del encuadre, fondo claro/oscuro,
sincronización de cursor con el diagrama de semianchos. AC: test Playwright que mide
con la herramienta una distancia conocida del trazado 1 con error < 1 px de snap.

**E3-3 Proyecto como fichero.** `.barrido.json` (schema versionado con migraciones):
vehículo + trazado (embebido o referencia) + reglas kin + obstáculos + UIC + vista.
Guardar/abrir/arrastrar; autosave en localStorage con recuperación al arrancar; export
también del vehículo suelto (compatibilidad con los JSON actuales). AC: abrir un
proyecto guardado reproduce resultados bit a bit (mismo hash de parámetros del cajetín).

**E3-4 Undo/redo** de toda edición de entrada (vehículo, rótulas, reglas, obstáculos).
AC: 50 operaciones aleatorias + 50 undo devuelven el estado inicial (test).

**E3-5 i18n ES/FR/EN.** Diccionarios planos, selector en menú, unidades y formato
numérico por locale (coma/punto) SOLO en presentación. Los exports CSV siempre con
punto decimal y separador `;` (Excel-ES friendly) — documentado en la cabecera.
AC: captura de las tres locales sin cortes de layout.

**E3-6 Accesibilidad.** Navegación completa por teclado, focus visible, contraste
AA en tema claro y oscuro, `prefers-reduced-motion`. AC: axe-core sin errores críticos.

---

## E4 · Reporting entregable (P1)

**E4-1 Informe de gálibo (la joya).** Vista "Informe" que genera un documento HTML
paginado para imprimir a PDF (Ctrl+P, con `@page`, cabecera/pie, "página X de Y"):

1. Portada con cajetín completo (proyecto, autor, fecha, versión, hash de parámetros).
2. Datos de entrada: tabla del vehículo + esquema a escala con cotas, tabla de rótulas,
   trazado (origen del fichero, longitud, radios mín por sentido), reglas cinemáticas.
3. Hipótesis y limitaciones del modelo (texto fijo de ENGINE_NOTES §1/§5, no editable).
4. Resultados: planta general vectorial (SVG), diagrama de semianchos, tabla por PK
   cada N m (configurable) con geo/kin/UIC, tabla de rótulas con máximos y límites.
5. Registro de clash completo con miniatura de localización por invasión.
6. Anexo: comparación UIC 505-1 si está activa, con la explicación del delta.
   AC: PDF de 8–15 páginas del caso demo legible en A4 e imprimible en B/N sin pérdida
   de semántica (¡los colores no pueden ser el único canal!: usar trazos discontinuos
   distintos por serie).

**E4-2 DXF pro.** Export con: capas normalizadas y documentadas, huella también como
HATCH opcional, etiquetas TEXT de PK cada 10 m y de máximos, bloques de marcador en
invasiones con atributo de margen, comentario de cabecera con versión+hash. Mantener
R12 como formato (compatibilidad universal) y validar con ezdxf en CI (script Python
en tools/ ejecutado por la pipeline). AC: abre limpio en AutoCAD, BricsCAD y QGIS.

**E4-3 XLSX.** SheetJS: hojas Parámetros / Perfil por PK / Rótulas / Clash / UIC, con
formato (cabeceras congeladas, anchos, número con 3 decimales, colores de estado).
AC: la hoja Perfil replica exactamente el CSV actual (test de paridad).

**E4-4 Comparador de escenarios (P2).** Cargar 2–4 resultados (proyectos) y superponer
envolventes con leyenda y tabla de deltas por PK; pensado para "vehículo A vs B sobre
el mismo trazado" en fase de licitación. AC: demo con los presets 5mod vs 3mod.

---

## E5 · Validación y confianza (P1)

**E5-1 Suite dorada en CI** (ya cubierta por E1-3, aquí la gobernanza): cualquier PR
que mueva un valor dorado exige actualización razonada de ENGINE_NOTES en el mismo PR.

**E5-2 Protocolo de validación externa.** Documento plantilla (docs/VALIDATION_PROTOCOL.md)
para contrastar contra un estudio de gálibo real o AutoTURN: qué inputs igualar, qué
tolerancias aceptar, tabla de resultados, causas admisibles de desviación. AC: el
documento existe y el informe E4-1 puede incrustar sus resultados como anexo.

**E5-3 Página "Modelo"** dentro de la app (Ayuda → Modelo) con las hipótesis, fórmulas
y limitaciones renderizadas — el usuario nunca debe tener que fiarse a ciegas.

---

## Trampas conocidas para quien implemente

1. NO "arreglar" la diferencia de 20 mm con la fórmula UIC exterior en R25: es de la
   UIC (1er orden), el motor es el exacto. Ver ENGINE_NOTES §4.1.
2. El bracketing de la cadena depende de hints del paso anterior: si se paraleliza el
   barrido, cada worker necesita su propio warm start secuencial por tramos.
3. localStorage está bien AQUÍ (app real fuera de claude.ai); el comentario histórico
   de "no usar localStorage" aplicaba solo al entorno de artefactos.
4. El signo de los offsets (izq +) está acoplado a la normal +90°: cualquier cambio
   rompe silenciosamente clash y kin. Hay test dorado que lo cubre; no tocar sin él.
5. Al portar a TS, `solveLin` lleva un test unitario propio (ver ENGINE_NOTES §6).
