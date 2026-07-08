# BARRIDO — sweep analysis para tranvías

Herramienta de análisis de barrido (swept path / envolvente cinemática) para material
rodante tranviario. Rol de la herramienta: **contra-cálculo de verificación** para un
ingeniero de integración/AMO — no compite con AutoTURN en producción de diseño, compite
en transparencia, auditabilidad y automatización.

## Estado actual (v0.4, "Fase 4")

Un único fichero HTML autocontenido (`dist/barrido_sweep_app.html`, ~92 KB) generado
por `python3 tools/build.py` a partir de:

- `src/engine.js` — motor puro (sin DOM). Trazado por curvatura o puntos, parser DXF
  (LINE/ARC/LWPOLYLINE con bulge/POLYLINE), cadena cinemática multicuerpo N módulos,
  solver de equilibrio Newton multivariable para rótulas bisectriz, envolvente
  geométrica por barrido + envolvente cinemática por reglas cuasi-estáticas, clash
  check contra obstáculos, peralte por tabla CSV, comparación UIC 505-1, export DXF R12.
- `src/ui.js` — toda la interfaz (vanilla JS, canvas 2D).
- `src/app_shell.html` — layout + CSS + puntos de inyección `/*__ENGINE__*/`, `/*__UI__*/`.

El motor está **validado numéricamente** contra casos analíticos: los valores dorados
están en `docs/ENGINE_NOTES.md` y son la red de seguridad de cualquier refactor.
**Regla de oro: ningún cambio en `engine.js` se mergea sin que pasen los valores dorados.**

## Objetivo de la siguiente etapa

Convertirlo en herramienta profesional: repo con build real, TypeScript, tests,
rediseño completo de UI según `docs/DESIGN_SPEC.md`, reporting de calidad entregable
(PDF/DXF/XLSX) según `docs/BACKLOG.md`. El artefacto de distribución debe seguir
siendo **un único HTML sin servidor** (requisito duro: se usa en entornos corporativos
sin poder instalar nada).

## Convenciones

- Idiomas: código e identificadores en inglés; UI en español (i18n ES/FR/EN en backlog E3).
- Unidades internas SIEMPRE en metros y radianes; conversión solo en la capa de UI.
- Convenio geométrico: curvatura k>0 = curva a izquierda; normal de estación n = +90°
  respecto al rumbo; offsets laterales con signo (izq +, dcha −).
- El sentido de marcha es el sentido de dibujo del eje.
- Nada de dependencias con licencia no permisiva. Preferir MIT/BSD/Apache-2.
- Cada hipótesis física del modelo se documenta en `docs/ENGINE_NOTES.md` y se muestra
  al usuario donde proceda (la honestidad sobre los límites del modelo es un feature).
- Prohibido eliminar o suavizar los disclaimers de EN 15273 / UIC 505 en UI y reports.

## Comandos (estado actual)

```bash
python3 tools/build.py                 # ensambla dist/barrido_sweep_app.html
node -e "require('./src/engine.js')"   # smoke de sintaxis del motor
python3 tools/gen_trazados.py          # regenera los DXF de demo (requiere ezdxf)
```

Tras completar E1 del backlog, estos comandos se sustituyen por `npm run dev|build|test`.

## Errores históricos que no deben repetirse (ver ENGINE_NOTES §6)

1. Módulos suspendidos dibujados con rumbo invertido 180° (huella hacia el exterior).
2. `r[i][i]` en la retro-sustitución de la eliminación gaussiana → todos los pasos de
   Newton NaN → el solver devolvía silenciosamente la solución sin optimizar.
   Moraleja: el solver de equilibrio necesita un test que verifique que la energía
   FINAL es menor que la inicial, no solo que no explota.
