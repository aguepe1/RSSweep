# BARRIDO — sweep analysis para tranvías

<!-- Al publicar el repo, sustituir OWNER por la cuenta/organización de GitHub. -->

[![CI](https://github.com/OWNER/barrido/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/barrido/actions/workflows/ci.yml)

Herramienta de análisis de barrido (swept path / envolvente cinemática) para
material rodante tranviario. Contra-cálculo de verificación para integración/AMO:
transparente, auditable y automatizable. El artefacto de distribución es **un
único HTML autocontenido, sin servidor y sin peticiones de red**.

## Comandos

```bash
npm install          # dependencias
npm run dev          # servidor de desarrollo (Vite) en http://localhost:5173
npm run build        # genera dist/index.html (HTML único, offline, ~198 KB gzip)
npm run typecheck    # tsc --noEmit (estricto, cero any en el motor)
npm run lint         # eslint + prettier --check
npm test             # tests de motor (Vitest): valores dorados + propiedad + unidad
npm run test:e2e     # flujos de UI (Playwright): importar DXF → calcular → exportar
```

## Estructura

- `CLAUDE.md` — brief del proyecto, convenciones y reglas de trabajo (leer primero)
- `docs/ENGINE_NOTES.md` — modelo físico, hipótesis y **valores dorados de validación**
- `docs/DESIGN_SPEC.md` — especificación del rediseño profesional
- `docs/BACKLOG.md` — épicas E1–E5 con tareas y criterios de aceptación
- `src/engine/` — motor puro en TypeScript (sin DOM), tipos en `src/types.ts`
- `src/ui/` — interfaz en TypeScript (canvas 2D); `src/main.ts` es el punto de entrada
- `index.html` — shell de la app (entrada de Vite)
- `tests/` — Vitest (motor); `e2e/` — Playwright (flujos de UI)
- `demos/` — 5 trazados DXF + obstáculos + peralte CSV para pruebas
- `dist/` — salida del build (HTML único)

## Regla de oro

Ningún cambio en el motor se mergea sin que pasen los **valores dorados**
(`docs/ENGINE_NOTES.md`, fixtures en `tests/golden.test.ts`).
