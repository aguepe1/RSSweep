# BARRIDO — sweep analysis para tranvías

Herramienta de análisis de barrido (swept path / envolvente cinemática) para material
rodante tranviario. Rol de la herramienta: **contra-cálculo de verificación** para un
ingeniero de integración/AMO — no compite con AutoTURN en producción de diseño, compite
en transparencia, auditabilidad y automatización.

## Estado actual (v0.5)

Aplicación **TypeScript + Vite** que se compila a **un único HTML autocontenido**
(`dist/index.html`, ~0,5 MB) sin peticiones de red en runtime (fuentes empaquetadas):
requisito duro, se usa en entornos corporativos sin poder instalar nada.

- `src/engine/` — motor puro en TypeScript (sin DOM), tipos compartidos en `src/types.ts`.
  Trazado (`track`), parser DXF y export R12 (`dxf`), import LandXML (`landxml`), cadena
  cinemática multicuerpo + solver de equilibrio Newton (`chain`), barrido y envolvente
  (`sweep`, `envelope`), reglas cuasi-estáticas de peralte (`kinematic`), clash check
  (`clash`), comparación UIC 505-1 (`uic`), agregación para informes (`report-data`),
  presets (`presets`). Barrel público en `src/engine/index.ts`. **Cero `any` en el motor.**
- `src/ui/` — interfaz en TypeScript (canvas 2D + SVG); `src/main.ts` es el punto de
  entrada. Web Worker para el barrido (`sweep-worker`), i18n ES/FR/EN (`i18n`), editor
  interactivo del tren (`train-editor`), proyecto como fichero + autosave (`project`),
  undo/redo (`history`, `undo-stack`), viewport CAD (`viewport`), etc.
- `index.html` — shell de la app (entrada de Vite; el HTML final se genera con
  `vite-plugin-singlefile`).

El motor está **validado numéricamente** contra casos analíticos: los valores dorados
están en `docs/ENGINE_NOTES.md §4` y son tests obligatorios (`tests/golden.test.ts`).
**Regla de oro: ningún cambio en `src/engine/` se mergea sin que pasen los valores
dorados.** El plan de trabajo priorizado hacia v1.0 está en `docs/ROADMAP.md`.

## Objetivo de la siguiente etapa

Ver `docs/ROADMAP.md` (auditoría + fases). El gran hueco pendiente es el **reporting
entregable** (informe PDF/print, XLSX, DXF pro — épica E4 del `docs/BACKLOG.md`); más
robustez/confianza del motor, gobernanza de release/CI y pulido de accesibilidad/i18n.
El artefacto de distribución debe seguir siendo **un único HTML sin servidor**.

## Convenciones

- Idiomas: código e identificadores en inglés; UI en español (i18n ES/FR/EN, `src/ui/i18n.ts`).
- Unidades internas SIEMPRE en metros y radianes; conversión solo en la capa de UI.
- Convenio geométrico: curvatura k>0 = curva a izquierda; normal de estación n = +90°
  respecto al rumbo; offsets laterales con signo (izq +, dcha −).
- El sentido de marcha es el sentido de dibujo del eje.
- Nada de dependencias con licencia no permisiva. Preferir MIT/BSD/Apache-2.
- Cada hipótesis física del modelo se documenta en `docs/ENGINE_NOTES.md` y se muestra
  al usuario donde proceda (la honestidad sobre los límites del modelo es un feature).
- Prohibido eliminar o suavizar los disclaimers de EN 15273 / UIC 505 en UI y reports.

## Comandos

```bash
npm install          # dependencias
npm run dev          # servidor de desarrollo (Vite) en http://localhost:5173
npm run build        # genera dist/index.html (HTML único, offline)
npm run typecheck    # tsc --noEmit (estricto, cero any en el motor)
npm run lint         # eslint + prettier --check
npm test             # tests de motor (Vitest): valores dorados + propiedad + unidad
npm run test:e2e     # flujos de UI (Playwright): importar DXF → calcular → exportar
```

## Errores históricos que no deben repetirse (ver ENGINE_NOTES §6)

1. Módulos suspendidos dibujados con rumbo invertido 180° (huella hacia el exterior).
   Guarda: `tests/s6_regression.test.ts` (radio del punto medio hacia el interior).
2. `r[i][i]` en la retro-sustitución de la eliminación gaussiana → todos los pasos de
   Newton NaN → el solver devolvía silenciosamente la solución sin optimizar.
   Moraleja: el solver de equilibrio necesita un test que verifique que la energía
   FINAL es menor que la inicial, no solo que no explota. Guardas:
   `tests/s6_regression.test.ts` (`energyFinal < energyInitial`) y `tests/unit.test.ts`
   (`solveLin` singular → null).
