# VALIDATION_PROTOCOL — protocolo de validación del motor (E5-2)

Este documento describe **cómo se valida numéricamente** el motor de BARRIDO, qué
casos se comprueban, con qué tolerancias y cómo reproducirlos. Es el complemento
operativo de `docs/ENGINE_NOTES.md` (que describe el modelo y las hipótesis) y la
base de la gobernanza de release: **ningún cambio en `src/engine/` se mergea sin que
pase la batería de valores dorados.**

## 1. Rol del contra-cálculo

BARRIDO es una herramienta de **contra-cálculo de verificación** del barrido (swept
path / envolvente cinemática). No es un cálculo de gálibo certificado EN 15273 ni
sustituye a AutoTURN en producción de diseño. Por tanto su validación no persigue una
certificación normativa, sino **demostrar que el motor reproduce resultados analíticos
exactos allí donde existen y que no regresa** frente a una batería de valores fijados
(«dorados»). La honestidad sobre los límites del modelo es un feature: las limitaciones
conocidas se enumeran en §6 y en `ENGINE_NOTES.md §5`.

## 2. Niveles de validación

1. **Analítico exacto** — casos con solución cerrada (dos ejes rígido en círculo,
   sagitta de cuerda, coche de dos bogies). Tolerancia 1 mm salvo indicación.
2. **Regresión funcional** — métricas del vehículo/trazado de referencia congeladas a
   un valor dorado. Tolerancia 2 mm / 0,1°.
3. **Matriz de humo** — ancho total geométrico para 3 tamaños de vehículo × 5 trazados.
   Tolerancia 1 cm.
4. **Propiedad** — invariantes que deben cumplirse para cualquier entrada (monotonía,
   simetría del reverso, energía final < inicial del solver, etc.).
5. **Robustez** — entradas degeneradas y límite (trazado de <2 puntos, segmento de
   longitud nula, vehículo/trazado vacío) que deben fallar de forma controlada.

## 3. Cómo reproducir

```bash
npm install
npm test          # Vitest: dorados + propiedad + unidad + robustez (nivel 1–5)
npm run typecheck # tsc estricto, cero any en el motor
npm run test:e2e  # Playwright: flujos de UI (importar → calcular → exportar)
```

Los valores dorados viven en `docs/ENGINE_NOTES.md §4` y se comprueban en
`tests/golden.test.ts`. El vehículo de referencia es el preset **«5 módulos ~32 m»**;
el trazado 1 de referencia es recta 20 + clotoide 10 + arco R25 90° + clotoide 10 +
recta 20 (L = 99,27 m).

## 4. Casos analíticos exactos (nivel 1)

| Caso                                                         | Valor motor | Referencia analítica                                    | Tol.   |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------- | ------ |
| 2 ejes rígido (L=9, empate 6, b=1,325) en R25, interior      | 1,5048      | b + a²/8R = 1,5050                                      | 1 mm   |
| Ídem, exterior                                               | 1,5296      | radial exacto √((√(R²−a²/4)+b)² + 4,5²) − R = 1,5293    | 1 mm   |
| Coche 2 bogies (L=14, pivotes 2,50/11,50, a=9) R25, interior | 1,7007      | dorado analítico (bisección de rigidez, cuerda pivotes) | 2 mm   |
| Ídem, exterior                                               | 1,7803      | dorado analítico                                        | 2 mm   |
| Inset del pivote biBogie = p²/8R en R25                      | 0,0171      | 1,85²/(8·25) = 17,1 mm                                  | 0,5 mm |

Nota UIC: la fórmula UIC de primer orden para el exterior del caso de dos ejes da
1,5500 (+20 mm respecto al radial exacto). **No es un error del motor**: es la
diferencia esperada de la aproximación de primer orden en radios pequeños, y así se
documenta.

## 5. Regresión funcional y matriz de humo (niveles 2–3)

Métricas congeladas más relevantes (extracto de `ENGINE_NOTES.md §4.2`; step 0,2):

| Métrica                                           | Valor dorado                |
| ------------------------------------------------- | --------------------------- |
| Trazado 1, geo: ancho total / int / ext           | 3,244 / 1,575 / 1,669       |
| Trazado 1, kin defaults: total / izq / dcha       | 3,489 / 1,749 / 1,740       |
| Ángulos rótula trazado 1 (libre): R1..R4          | 19,4 / 15,3 / 15,3 / 19,4 ° |
| Bisectriz k=50 en R25 estacionario: las 4 rótulas | −14,72 ± 0,03° (iguales)    |
| Todos los bogies rígidos, trazado 1: exterior     | 1,669 → 1,653 (Δ ≈ −p²/8R)  |
| Clash demo: margen mín kin / solo geo             | −167 mm @ PK 52 / ≈ +50 mm  |

La matriz de humo (step 0,25, ancho total geo, tol 1 cm) cubre 5mod/3mod/7mod × 5
trazados (R25+clotoides, bucle R20, contracurva S, chicane R50, R100). Ver la tabla
completa en `ENGINE_NOTES.md §4.3`.

## 6. Invariantes de propiedad (nivel 4)

- **Solver de equilibrio**: la energía final debe ser estrictamente menor que la
  inicial (`tests/s6_regression.test.ts`). Un solver que devuelve la solución sin
  optimizar «no explota» pero **sí** viola este invariante — de ahí el test.
- **Reverso simétrico**: recorrer un trazado simétrico (recta+arco+recta) en sentido
  inverso da interior/exterior iguales a la marcha directa (±2 mm).
- **Monotonía de travesía**: ampliar el rango de barrido no reduce la envolvente.
- **Bisectriz → libre**: con rigidez k→0 la solución bisectriz converge a la libre
  (< 0,05° de desviación).

## 7. Robustez y regresiones históricas (nivel 5)

`tests/robustness.test.ts` y `tests/unit.test.ts` cubren entradas degeneradas
(trazado con <2 puntos, segmento de longitud nula, vehículo o trazado vacíos) que
deben producir un error controlado, no un `NaN` silencioso ni un cuelgue.

Guardas contra los bugs históricos (`ENGINE_NOTES.md §6`), que **no deben repetirse**:

1. Módulos suspendidos dibujados con rumbo invertido 180° (huella hacia el exterior).
   Guarda: `tests/s6_regression.test.ts` (el punto medio va hacia el interior).
2. `r[i][i]` mal indexado en la retro-sustitución gaussiana → pasos de Newton NaN → el
   solver devolvía en silencio la solución sin optimizar. Guardas: energía final <
   inicial (`s6_regression`) y `solveLin` singular → `null` (`unit.test.ts`).

## 8. Límites conocidos (no son fallos)

Documentados en `ENGINE_NOTES.md §5` y mostrados en la app (Ayuda ▸ Modelo y límites):

- Horquillas de radio inviable → doble ocupación real (región conexa), no separable
  por unión booleana. Para radios navegables (R≳20 m) no hay contaminación.
- Lazo de caja por defecto = secante (amortiguadores centrados); solo se relaja con
  rótulas bisectriz.
- Envolvente cinemática = reglas cuasi-estáticas simplificadas, **no** EN 15273
  certificada.
- Travesía completa (opt-in): fuera del trazado el eje se prolonga en recta con el
  rumbo del extremo; si el trazado real sigue en curva, la huella de entrada/salida es
  optimista.

## 9. Gobernanza

- **Regla de oro**: ningún cambio en `src/engine/` se mergea sin los valores dorados
  en verde. Es un test obligatorio en CI (`.github/workflows/ci.yml`).
- Si un cambio del motor altera legítimamente un valor dorado, se actualiza a la vez la
  tabla de `ENGINE_NOTES.md §4`, el test y este protocolo, y se justifica en el PR.
- El artefacto de distribución (`dist/index.html`) se valida además con un **smoke test
  offline**: se abre el HTML único vía `file://` sin servidor y debe arrancar y
  calcular sin ninguna petición de red (ver `e2e/offline.spec.ts`).
