# DESIGN_SPEC — de demo a instrumento profesional

## 0. Diagnóstico del diseño actual

Lo que hay funciona pero grita "dashboard generado": tema oscuro por defecto, acento
ámbar decorativo, tarjetas redondeadas, hints verbosos, jerarquía plana. Un ingeniero
que lo abra delante de un cliente tiene que ver un **instrumento**, no una demo.

## 1. Dirección

**"Mesa de delineación digital"**: la estética de la documentación ferroviaria bien
hecha — planos, cajetines, tablas de gálibo — llevada a pantalla. Referencias de tono:
software CAD serio (no sus menús, su sobriedad), documentación técnica suiza, informes
de ingeniería impresos. La personalidad sale de la precisión y la densidad de datos
correcta, no de colores ni efectos.

## 2. Reglas duras (anti-patrón "diseño IA")

PROHIBIDO: gradientes, glassmorphism, sombras difusas, glows, emojis, iconos rellenos
gordos, border-radius > 4 px, animaciones decorativas, tono de marketing en microcopy
("¡Listo!", "✨"), tarjetas flotantes con padding gigante, violeta/índigo como acento,
skeleton loaders con shimmer, dark-mode-por-defecto-porque-sí.

OBLIGATORIO: tema claro por defecto (los entregables se imprimen y se proyectan en
salas con luz); bordes hairline 1 px; `font-variant-numeric: tabular-nums` en TODO
número; unidades siempre visibles; grid de 8 px; densidad alta (filas de tabla 28 px);
estados vacíos con instrucción concreta, no ilustración.

## 3. Sistema

**Color.** UI casi monocroma; el color es EXCLUSIVAMENTE semántica de datos:

- Papel `#FAFAF8`, superficie `#FFFFFF`, tinta `#1A1D21`, secundario `#5A6470`,
  hairline `#D9DDE2`, viewport claro `#FFFFFF` / oscuro `#14171C` (toggle).
- Datos: huella geométrica `#C62828`, envolvente cinemática `#B8860B`, UIC `#2E7D32`,
  vehículo `#1565C0`, fuelle `#78838F`, obstáculos `#1A1D21`, invasión `#C62828` sólido.
- Un único color de acción (enlaces/botón primario): `#1A1D21` (sí, negro; el botón
  primario es negro sólido con texto blanco — sobriedad, no branding).

**Tipografía.** UI: `IBM Plex Sans` (400/500/600). Datos, tablas, PK, coordenadas,
cajetín: `IBM Plex Mono`. Nada más. Escala: 11/12/13/15/18. Títulos de sección en
versalitas espaciadas (letter-spacing .08em), 11 px, peso 600 — como rótulos de plano.

**Iconografía.** Lucide, trazo 1.5 px, 16 px, solo donde un icono sustituya texto sin
ambigüedad (zoom, capas, play). Ante la duda: texto.

## 4. Layout objetivo

```
┌ Barra de menú: Archivo · Vehículo · Trazado · Cálculo · Informes · Ayuda   [ES] ┐
├──────────────┬───────────────────────────────────────────────┬─────────────────┤
│ Panel        │  VIEWPORT CAD                                 │ Panel resultados│
│ entrada      │  · reglas + barra de escala + norte           │ · cajetín       │
│ (pestañas:   │  · readout X/Y/PK/offset bajo cursor          │ · tabla rótulas │
│  Vehículo /  │  · toggles de capas (huella/kin/UIC/obst/veh) │ · tabla clash   │
│  Trazado /   │  · fondo blanco/negro, medición 2 clics       │   (ordenable,   │
│  Reglas /    │  · timeline de recorrido con PK               │   clic → zoom)  │
│  Obstáculos) │                                               │                 │
├──────────────┴───────────────────────────────────────────────┴─────────────────┤
│ Diagrama de semianchos por PK (sincronizado con cursor y viewport)             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Barra de estado: fichero · unidades · nº pasos · tiempo · versión · hipótesis  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Paneles laterales colapsables y redimensionables (drag en el borde). El diagrama de
semianchos y el viewport comparten cursor: hover en uno marca el PK en el otro.

## 5. Componentes con especificación propia

- **Input numérico de ingeniería**: unidad DENTRO del campo a la derecha en gris;
  drag vertical para ajustar (à la Blender), flechas ±paso, Shift=×10; valida rango y
  marca en rojo con motivo; nunca borra lo tecleado.
- **Tabla de módulos**: tabla real editable (no tarjetas), columnas Id·Tipo·Long·Ancho·
  Pivote·Empate·Bogie·Cab, fila de totales, reordenación por drag del handle, y un
  **esquema del vehículo dibujado a escala** encima (SVG) con cotas — es la pieza de
  confianza nº1: el usuario VE que ha definido lo que cree.
- **Tabla de rótulas**: R#, módulos, tipo, hueco, fuelle, límite, ángulo máx (barra
  horizontal proporcional al límite), PK crítico; excedidos en rojo con fila resaltada.
- **Registro de clash**: tabla ordenable con margen, PK, offset, estado; clic centra el
  viewport en el punto; export directo desde la cabecera de la tabla.
- **Cajetín**: réplica visual de un cajetín de plano (marco, casillas), con proyecto,
  vehículo, trazado, hipótesis activas, fecha, versión de la app y hash de parámetros.
- **Atajos**: Space play/pausa, ←→ scrub (Shift ×10), F encuadrar, M medir, 1–5 capas,
  Ctrl+Z/Y undo/redo, Ctrl+S guardar proyecto, Ctrl+P informe.

## 6. Viewport CAD (detalle)

Barra de escala dinámica (1 m/5 m/10 m según zoom), rejilla métrica sutil opcional,
marcas de PK cada 10 m sobre el eje con etiqueta, tooltip de envolvente al hover
(semiancho geo/kin en ese PK), herramienta de medición (distancia + Δoffset), export
PNG/SVG del encuadre actual a resolución de impresión (300 dpi equivalente).
Reduced-motion: sin animación de reproducción automática.

## 7. Impresión

`@media print` de primera clase: el informe HTML (ver BACKLOG E4-1) se imprime a PDF
desde el navegador con paginación correcta, cabecera/pie con proyecto y paginación
X de Y, y los SVG vectoriales (nada de canvas rasterizado en el informe).
