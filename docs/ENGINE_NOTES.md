# ENGINE_NOTES — modelo, hipótesis y valores dorados

## 1. Modelo cinemático

**Trazado.** Curva paramétrica por longitud de arco s. Dos constructores:
`trackFromSegments` (integración trapezoidal de curvatura k(s) a tramos:
recta/clotoide/arco, ds=0.02) y `trackFromPoints` (polilínea densificada, p.ej. de DXF;
los arcos/bulges se muestrean a 0.05 m en el import). `heading(s)` por diferencia finita
±0.25 m; `secantHeading(s, base)` = rumbo de la cuerda de longitud `base` centrada en s.

**PK de proyecto (E2-4).** El import LandXML muestrea `CoordGeom` (Line/Curve/Spiral
clotoide, 0.05 m) a polilínea densa y alimenta `trackFromPoints`. Además construye un
`PkMap` (puntos de control `{s, pk}` ordenados por arco): `staStart` fija el PK en s=0 y
cada ecuación de PK (`StaEquation`) añade un punto en `s = staInternal − staStart` con el
nuevo valor `staAhead`. Entre control points el PK avanza 1:1 con la distancia
(`pk = cp.pk + (s − cp.s)`), de modo que las ecuaciones son saltos de valor, no cambios
de escala. El motor trabaja SIEMPRE en longitud de arco `s`; `pkAt(map, s)` / `sAtPk(map,
pk)` traducen s↔PK solo en presentación e informes (perfil, clash, cajetín, CSV). Presets
y DXF reinician el mapa (PK = arco). Hipótesis: `staInternal` es la estación interna
continua en la ruptura; con ecuaciones solapadas la inversa toma la primera coincidencia.

**DXF industrial (E2-3).** El parser acepta exports reales de Civil 3D / MicroStation sin
pre-editar. Las entidades `SPLINE` se muestrean por De Boor en coordenadas homogéneas
(NURBS racional: pesos código 41; si faltan, B-spline con pesos 1), con nudos código 40 o,
en su ausencia, nudos clamped uniformes deducidos de grado (71) y nº de control; si no hay
polígono de control se recurre a los fit-points (11/21). La densidad se acota a ≤20 000
muestras por curva. `$INSUNITS` de la cabecera fija una escala a metros (in/ft/mm/cm/m…)
que se aplica a TODAS las coordenadas tras el muestreo, con aviso al usuario; sin
`$INSUNITS` se asume metros. Cada cadena guarda su capa (código 8) y se expone la lista de
capas del dibujo. `joinChains(chains, opts)` acepta `{layer, chainLayers, flip}`: filtra
las cadenas por capa de eje y, con `flip`, invierte el sentido de marcha (el eje se recorre
al revés). En la UI, con varias capas se propone por defecto la capa de la cadena más larga
(heurística: el eje suele ser la polilínea mayor, no la anotación) y se permite corregirla
e invertir el sentido; ambos re-unen sin re-parsear. Hipótesis: una única cadena de eje por
capa seleccionada; el orden de unión es el de aparición en el fichero.

**Vehículo.** Cadena de módulos `bogie` | `suspendido`. Reglas:

- Módulo **bogie pivotante**: pivote SOBRE el eje de vía en arco s_i; lazo de caja ψ_i =
  secante local sobre el empate (hipótesis: amortiguadores anti-lazo centran la caja)
  salvo que el solver de equilibrio lo libere (ver §2).
- Módulo **bogie rígido**: conjunto caja+rodadura solidario. Rumbo = secante (forzado,
  sin libertad) y anclaje en el punto medio de la cuerda del empate → desplazado hacia
  el interior de la curva la sagitta p²/8R. Es el modelo correcto para vehículos de dos
  ejes y pseudo-bogies fijos, y el caso de validación exacta contra UIC 505 (§4.1).
- Módulo **suspendido**: cuerda rígida entre la articulación trasera del cuerpo anterior
  y la delantera del siguiente bogie. La posición del siguiente pivote se resuelve con
  la restricción |A − B(s)| = ΣL_susp (bisección con bracketing en dos fases: ±0.9 m
  alrededor del hint del paso anterior, fallback ±4.5 m).
- Rótulas: `libre` (pivote sin control), `rigida` (módulos solidarios; PROHIBIDA aguas
  arriba de un bogie: sobredeterminaría el pivote guiado), `bisectriz` (bielas de
  centrado; requiere módulo suspendido adyacente).
- Fuelles: los testeros se retranquean gap/2 a cada lado de la rótula; el fuelle es el
  cuadrilátero entre las dos caras (ancho propio) y SÍ entra en la envolvente.
- **Contorno de módulo (E2-6).** El cuerpo puede definirse como un contorno 2D en el
  marco local (`contour`: lista cerrada [x, y]; x = distancia longitudinal desde el
  frente F en [0, length], y = lateral ± hacia la normal). Si falta, se usa el
  rectángulo semiancho. El contorno se encaja LINEALMENTE en el cuerpo dibujado
  `[fs, length−rs]` (mismos retranqueos gap/2 que el rectángulo): así el rectángulo
  explícito reproduce el barrido por defecto bit a bit y un chaflán, al estar contenido
  en el rectángulo, nunca aumenta la envolvente. Presets `rectContour`/`chamferContour`
  (chaflán de profundidad d y anchura w en los testeros de cabina). Hipótesis: el
  contorno es rígido y solidario a la caja; no modela deformación ni vuelo dinámico.

## 2. Solver de equilibrio (bisectriz)

Minimiza E(ψ) = Σ_libres (ψ_i − secante_i)² + Σ_centrados k_j·(θ_prev + θ_next − 2θ_susp)²
sobre los lazos ψ de los bogies pivotantes (los rígidos quedan excluidos). Para cada ψ,
las posiciones se resuelven con la cadena secuencial (§1). Optimización: Newton
multivariable con gradiente/hessiana por diferencias finitas (h=3e-4 rad), amortiguación
Levenberg (λ×10 hasta aceptar), paso limitado a ±0.25 rad, warm start de ψ y de pivotes
entre pasos de simulación. Sin rótulas bisectriz → camino rápido sin optimización.

## 3. Envolventes

**Geométrica.** Unión implícita por estaciones (E2-2): cada 0.25 m de eje se registran
los offsets extremos izq/dcha de todos los contornos muestreados (cuerpos + fuelles +
espejos, muestreo de aristas 0.30 m) proyectados a la estación más cercana. Convenio de
signo off = (p−C)·N. La geometría maestra es el contorno remapeado (cinta cerrada +N/−N,
`SweepResult.envelope`); el perfil por PK (`rows`) se deriva del mismo remapeo.

**Aislamiento entre ramas (ventana longitudinal).** Cada muestra de un paso s1 sólo se
remapea a estaciones dentro de la abscisa que ocupa el vehículo en ese paso,
[s1 − long. vehículo − 6 m, s1 + 6 m]. Así una rama separada de otra por más que esa
ventana en abscisa nunca contamina el perfil de la opuesta aunque estén cerca en el
plano (auto-aproximaciones de bucle largo). Verificado en `tests/fork.test.ts`.

LÍMITE CONOCIDO (fixture `hairpin`, tests/fork.test.ts). En horquillas de radio inviable
(< radio mínimo del material) un vehículo articulado largo ENVUELVE físicamente ambas
ramas a la vez: la región barrida es CONEXA y su ancho grande es la doble ocupación real
del barrido, no un artefacto de remapeo. Ninguna unión booleana de polígonos lo separa
(se comprobó: el intervalo unido a lo largo de la normal es una sola componente que
contiene el centro). Se evaluó `polyclip-ts` (MIT) para la unión exacta global y resultó
inviable (unión global O(n²) intratable con ~miles de cuádriláteros muy solapados;
errores de robustez "Unable to complete output ring" en unión incremental). Para radios
navegables (R≥~20 m) no hay contaminación: la proyección por estaciones ya es correcta.

**Cinemática (reglas cuasi-estáticas simplificadas — NO EN 15273 certificada).**
Por estación, con curvatura local k y factor c = min(1, |k|·R_pleno):

- Peralte D(s) = D_max·c, o interpolado de tabla CSV pk;D_mm si está cargada.
- Interior: h·D/e + σ·(E/e)·(h−h₀), con E = D si "vehículo parado" activo.
- Exterior: max(0, σ·(I·c/e)·(h−h₀) − h·D/e).
- Insuficiencia I y exceso E (E2-7). Sin perfil de velocidad se usa el escalado
  heurístico por curvatura (I = I_max·c; E = D si "vehículo parado"). Con tabla CSV
  pk;v_kmh cargada se calcula la insuficiencia REAL I(s) = B·v²·k − D(s), con
  B = e/g (peralte de equilibrio, g = 9.81): la parte positiva es insuficiencia
  (I = max(0, I(s)), sobreancho exterior) y la negativa exceso (E = max(0, −I(s)),
  interior). En la velocidad de equilibrio (I(s)=0 en toda la curva) la envolvente
  exterior cinemática coincide con la del caso I_max=0 global. Nota: con los
  defaults el término geométrico de peralte h·D/e domina insuficiencias modestas;
  hace falta v ≳ 4·v_eq para que el sobreancho exterior supere ese término.
- Ambos lados: + q (juegos) + T_alineación + h·T_peralte/e.
  Defaults: h=1.60, e=1.50, D_max=120 mm, R_pleno=30, I=100 mm, σ=0.25, h₀=0.70,
  q=35 mm, T_al=20 mm, T_D=15 mm.

## 4. Valores dorados (tests de regresión obligatorios)

Vehículo de referencia = preset "5 módulos ~32 m", trazado 1 = recta 20 + clotoide 10 +
arco R25 90° + clotoide 10 + recta 20 (L=99.27 m). step de simulación indicado.

### 4.1 Validación analítica exacta (tolerancia 1 mm salvo indicado)

| Caso                                                                       | Valor motor | Referencia analítica                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 ejes rígido (1 módulo L=9, empate a=6, b=1.325) en círculo R25, interior | 1.5048      | b + a²/8R = 1.5050                                                                                                                                      |
| Ídem, exterior                                                             | 1.5296      | radial exacto √((√(R²−a²/4)+b)² + 4.5²) − R = 1.5293. NOTA: la fórmula UIC 1er orden da 1.5500 (+20 mm): diferencia esperada en R pequeños, no es error |
| Sagitta cuerda 13.9 m en R25                                               | —           | R − √(R²−6.95²) = 0.985 (usada en diseño del test de suspendidos)                                                                                       |

### 4.2 Regresión funcional (step 0.2, salvo indicado; tolerancia 2 mm / 0.1°)

| Métrica                                                              | Valor                               |
| -------------------------------------------------------------------- | ----------------------------------- |
| Trazado 1, geo: ancho total / int / ext                              | 3.244 / 1.575 / 1.669               |
| Trazado 1, kin defaults: total / izq / dcha                          | 3.489 / 1.749 / 1.740               |
| Trazado 1, kin con tabla CSV equivalente a la ley                    | 3.487                               |
| Ángulos rótula trazado 1 (libre): R1..R4                             | 19.4 / 15.3 / 15.3 / 19.4 °         |
| R1 rígida en trazado 1: ángulos R1 / R2, ancho                       | 0.0° / 30.5°, 4.86 m                |
| Bisectriz k=50, círculo R25 estacionario (s1=80): las 4 rótulas      | −14.72 ± 0.03° (IGUALES entre sí)   |
| Bisectriz k→0.001: desviación máx vs libre                           | < 0.05°                             |
| Bucle R20: libre vs bisectriz k=50, ángulo máx                       | 24.4° → 21.2° (ancho 3.33 → 3.60)   |
| Todos los bogies rígidos, trazado 1: exterior                        | 1.669 → 1.653 (Δ ≈ −p²/8R = −17 mm) |
| Equivalente UIC del 5-mod: a/n_a/p/b                                 | 13.9 / 2.3 / 1.85 / 1.325           |
| UIC en trazado 1: interior máx / Δ ancho vs simulado                 | 2.308 m / +1.118 m                  |
| Clash demo (obstaculos_demo_trazado1.dxf): margen mín kin / solo geo | −167 mm @ PK 52 / ≈ +50 mm          |

### 4.3 Matriz de humo (step 0.25, ancho total geo, tolerancia 1 cm)

| Trazado                                                                               | 5mod | 3mod  | 7mod |
| ------------------------------------------------------------------------------------- | ---- | ----- | ---- |
| 1 R25+clotoides                                                                       | 3.24 | 3.51* | 3.25 |
| 2 Bucle R20                                                                           | 3.33 | 3.71  | 3.33 |
| 3 Contracurva S                                                                       | 3.28 | 3.83  | 3.28 |
| 4 Chicane R50                                                                         | 3.23 | 3.25  | 3.21 |
| 5 R100                                                                                | 3.17 | 2.92  | 3.17 |
| (*el 3mod tiene b=1.20; sus totales no son comparables en absoluto con los otros dos) |

## 5. Limitaciones conocidas (candidatas a E2)

1. Envolvente por estaciones: aislada entre ramas por ventana longitudinal (§3, E2-2).
   Límite residual: horquillas de radio inviable → doble ocupación real (conexa), no
   corregible por unión booleana; documentado como fixture `hairpin` (tests/fork.test.ts).
2. Lazo de caja = secante como cierre por defecto: aproximación "amortiguadores
   centrados"; el equilibrio la relaja solo con bisectriz. Documentar siempre.
3. Articulaciones de módulos suspendidos: solo en los extremos del módulo (offsets no
   soportados en suspendidos; sí en bogies).
4. Cajas rectangulares: sin afinamiento de testeros de cabina (conservador en interior).
5. DXF: soporta SPLINE (NURBS) e `$INSUNITS` (E2-3); sin ecuaciones de PK (eso lo aporta el
   import LandXML, E2-4). Sin selección de capa asume una sola cadena de eje por capa; el
   PK es longitud de arco. Para PK de proyecto, importar el alignment como LandXML.
6. Peralte por tabla: usa |D| y decide el lado por la curvatura; peraltes en recta se
   ignoran de facto.
7. Insuficiencia escalada por c (proporcional a curvatura): simplificación declarada.
8. Rendimiento bisectriz ~0.5–1.5 s por barrido: llevar a Web Worker (E2-2).

## 6. Historial de bugs con moraleja

- **Suspendidos girados 180°** (rumbo A1→A2 en vez de A2→A1): la huella salía +1.98 m
  hacia el exterior. Detección: el radio del punto medio del módulo suspendido era >R.
  Test derivado: en círculo puro, radio de punto medio de suspendido ≈ media de radios
  de sus articulaciones − sagitta de su cuerda.
- **`r[i][i]` en solveLin**: NaN silencioso → Newton nunca aceptaba → devolvía la
  solución inicial sin error visible. Test derivado: E_final < E_inicial SIEMPRE que
  haya rótulas bisectriz y gradiente inicial no nulo.
