// ============================================================================
// E2-3 — DXF industrial: SPLINE (NURBS), $INSUNITS (conversión), capas, inversión.
//  · SPLINE con polígono de control colineal ⇒ la curva es esa recta.
//  · $INSUNITS mm ⇒ coordenadas ×0.001 a metros, con aviso.
//  · Selección de capa de eje y flip del sentido de marcha en joinChains.
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDXF, joinChains } from "../src/engine/dxf";

/** Envuelve pares [código, valor] en un DXF mínimo con HEADER + ENTITIES. */
function dxf(header: Array<[number, string | number]>, entities: Array<[number, string | number]>) {
  const all: Array<[number, string | number]> = [
    [0, "SECTION"],
    [2, "HEADER"],
    ...header,
    [0, "ENDSEC"],
    [0, "SECTION"],
    [2, "ENTITIES"],
    ...entities,
    [0, "ENDSEC"],
    [0, "EOF"],
  ];
  return all.map(([c, v]) => `${c}\n${v}`).join("\n");
}

// SPLINE cúbica clamped con 4 puntos de control colineales (0,0)->(3,0).
const splineLine = dxf(
  [],
  [
    [0, "SPLINE"],
    [8, "EJE"],
    [70, 8],
    [71, 3],
    [72, 8],
    [73, 4],
    // 8 nudos clamped [0,0,0,0,1,1,1,1]
    [40, 0],
    [40, 0],
    [40, 0],
    [40, 0],
    [40, 1],
    [40, 1],
    [40, 1],
    [40, 1],
    [10, 0],
    [20, 0],
    [10, 1],
    [20, 0],
    [10, 2],
    [20, 0],
    [10, 3],
    [20, 0],
  ],
);

// Dos LINE en capas distintas (EJE y RUIDO); el eje real es la más larga.
const twoLayers = dxf(
  [],
  [
    [0, "LINE"],
    [8, "EJE"],
    [10, 0],
    [20, 0],
    [11, 50],
    [21, 0],
    [0, "LINE"],
    [8, "RUIDO"],
    [10, 0],
    [20, 5],
    [11, 3],
    [21, 5],
  ],
);

// LINE de 1000 mm con $INSUNITS = 4 (milímetros) ⇒ 1.0 m tras conversión.
const mmLine = dxf(
  [
    [9, "$INSUNITS"],
    [70, 4],
  ],
  [
    [0, "LINE"],
    [8, "0"],
    [10, 0],
    [20, 0],
    [11, 1000],
    [21, 0],
  ],
);

describe("§E2-3 DXF industrial", () => {
  it("muestrea un SPLINE colineal como la recta que definen sus puntos de control", () => {
    const r = parseDXF(splineLine);
    expect(r.chains.length).toBe(1);
    const ch = r.chains[0];
    expect(ch.length).toBeGreaterThan(10);
    expect(ch[0][0]).toBeCloseTo(0, 6);
    expect(ch[0][1]).toBeCloseTo(0, 6);
    expect(ch[ch.length - 1][0]).toBeCloseTo(3, 6);
    expect(ch[ch.length - 1][1]).toBeCloseTo(0, 6);
    // toda la curva permanece sobre la recta y = 0 y x ∈ [0,3] monótona.
    for (const p of ch) {
      expect(Math.abs(p[1])).toBeLessThan(1e-6);
      expect(p[0]).toBeGreaterThanOrEqual(-1e-6);
      expect(p[0]).toBeLessThanOrEqual(3 + 1e-6);
    }
  });

  it("aplica $INSUNITS mm → metros y avisa de la conversión", () => {
    const r = parseDXF(mmLine);
    expect(r.units!.code).toBe(4);
    expect(r.units!.scale).toBeCloseTo(0.001, 9);
    expect(r.chains[0][1][0]).toBeCloseTo(1, 9); // 1000 mm → 1 m
    expect(r.warnings.some((w) => /metros/.test(w))).toBe(true);
  });

  it("anota la capa de cada cadena y lista las capas distintas", () => {
    const r = parseDXF(twoLayers);
    expect(r.chainLayers).toEqual(["EJE", "RUIDO"]);
    expect(r.layers).toEqual(["EJE", "RUIDO"]);
  });

  it("joinChains filtra por capa de eje", () => {
    const r = parseDXF(twoLayers);
    const only = joinChains(r.chains, { layer: "RUIDO", chainLayers: r.chainLayers });
    expect(only.points).not.toBeNull();
    // la capa RUIDO va de (0,5) a (3,5): todos los puntos con y=5.
    for (const p of only.points!) expect(p[1]).toBeCloseTo(5, 6);
  });

  it("joinChains invierte el sentido de marcha con flip", () => {
    const r = parseDXF(twoLayers);
    const fwd = joinChains(r.chains, { layer: "EJE", chainLayers: r.chainLayers });
    const rev = joinChains(r.chains, { layer: "EJE", chainLayers: r.chainLayers, flip: true });
    const f = fwd.points!;
    const b = rev.points!;
    expect(b[0]).toEqual(f[f.length - 1]);
    expect(b[b.length - 1]).toEqual(f[0]);
  });

  it("importa un export estilo Civil 3D (SPLINE + $INSUNITS mm + capas) sin pre-editar", () => {
    // Fixture sintético con las convenciones típicas de un export Civil 3D:
    // eje NURBS en la capa C-ROAD-CNTR, anotación en C-ANNO-TEXT y dibujo en mm.
    const txt = readFileSync(resolve(__dirname, "../demos/eje_civil3d_spline_mm.dxf"), "utf8");
    const r = parseDXF(txt);
    expect(r.layers).toEqual(["C-ANNO-TEXT", "C-ROAD-CNTR"]);
    expect(r.units!.code).toBe(4); // milímetros
    expect(r.warnings.some((w) => /metros/.test(w))).toBe(true);
    const j = joinChains(r.chains, { layer: "C-ROAD-CNTR", chainLayers: r.chainLayers });
    const pts = j.points!;
    // El eje va de (0,0) a (60,5) m tras la conversión mm→m.
    expect(pts[0][0]).toBeCloseTo(0, 6);
    expect(pts[0][1]).toBeCloseTo(0, 6);
    expect(pts[pts.length - 1][0]).toBeCloseTo(60, 3);
    expect(pts[pts.length - 1][1]).toBeCloseTo(5, 3);
  });
});
