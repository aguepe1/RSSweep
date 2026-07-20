# BARRIDO — sweep analysis para tranvías

[![CI](https://github.com/aguepe1/RSSweep/actions/workflows/ci.yml/badge.svg)](https://github.com/aguepe1/RSSweep/actions/workflows/ci.yml)
[![Deploy](https://github.com/aguepe1/RSSweep/actions/workflows/pages.yml/badge.svg)](https://github.com/aguepe1/RSSweep/actions/workflows/pages.yml)

Herramienta de análisis de barrido (swept path / envolvente cinemática) para
material rodante tranviario. Contra-cálculo de verificación para integración/AMO:
transparente, auditable y automatizable. El artefacto de distribución es **un
único HTML autocontenido, sin servidor y sin peticiones de red**.

## Probar la aplicación (validación)

- **En el navegador (recomendado):** <https://aguepe1.github.io/RSSweep/> — se abre
  y funciona sin instalar nada. No envía datos a ningún sitio: todo el cálculo ocurre
  en tu navegador.
- **Sin conexión:** descarga el `index.html` de la [última _Release_](https://github.com/aguepe1/RSSweep/releases/latest)
  y ábrelo con doble clic. Es un único fichero (~0,5 MB) que funciona offline y se
  puede usar en entornos corporativos sin permisos de instalación.

Cómo se usa, en dos minutos: elige un preset de vehículo y de trazado (o importa un
DXF), pulsa **Calcular huella** y revisa la envolvente en el viewport y el diagrama de
semianchos. **Editar tren…** abre un editor visual para arrastrar bogies y ajustar
cajas, fuelles y rótulas. Los informes se exportan a CSV/DXF.

## Comandos (desarrollo)

```bash
npm install          # dependencias
npm run dev          # servidor de desarrollo (Vite) en http://localhost:5173
npm run build        # genera dist/index.html (HTML único, offline, ~283 KB gzip)
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

## Avisos normativos (leer antes de validar)

BARRIDO es una **herramienta de contra-cálculo de verificación**, no un cálculo de
gálibo certificado ni un sustituto de AutoTURN en producción de diseño. Su valor está
en la transparencia y auditabilidad del modelo, no en sustituir la normativa:

- **No es un cálculo certificado EN 15273.** La envolvente cinemática usa reglas
  cuasi-estáticas simplificadas declaradas en `docs/ENGINE_NOTES.md`; no implementa el
  procedimiento normativo completo de gálibos EN 15273.
- **UIC 505-1 excluye tranvías** y asume cuerpo rígido entre pivotes con fórmulas de
  primer orden; en radios pequeños difiere del cálculo exacto (documentado en la propia
  UI y en las notas del motor). La comparación UIC se ofrece solo como referencia.
- Cada hipótesis física del modelo se documenta en `docs/ENGINE_NOTES.md` y se muestra
  al usuario donde procede. La honestidad sobre los límites del modelo es un objetivo
  de diseño, no una nota al pie.

## Regla de oro

Ningún cambio en el motor se mergea sin que pasen los **valores dorados**
(`docs/ENGINE_NOTES.md`, fixtures en `tests/golden.test.ts`).

## Licencia

MIT — ver `package.json`. Sin dependencias con licencia no permisiva.
