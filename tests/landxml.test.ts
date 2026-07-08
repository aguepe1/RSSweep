// ============================================================================
// E2-4 — Import LandXML: geometría (Line/Curve/Spiral) + PK de proyecto.
//  · Puntos LandXML "N E" (northing easting) → plano [x=E, y=N].
//  · PkMap: staStart en s=0 + ecuaciones de PK (StaEquation) con salto de valor.
//  · AC: un alignment con staStart ≠ 0 muestra PKs de proyecto correctos.
// ============================================================================
import { describe, it, expect } from "vitest";
import { parseLandXML, pkAt, sAtPk } from "../src/engine/landxml";

// Alignment en L: recta E 100 m + ecuación de PK (→ 2000) + recta E 60 m.
// staStart = 1000 ⇒ PK(s) = 1000 + s hasta s=100; luego 2000 + (s−100).
const twoLinesEq = `<?xml version="1.0"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2">
  <Alignments>
    <Alignment name="EJE1" length="160" staStart="1000">
      <CoordGeom>
        <Line><Start>0 0</Start><End>0 100</End></Line>
        <Line><Start>0 100</Start><End>0 160</End></Line>
      </CoordGeom>
      <StaEquation staInternal="1100" staBack="1100" staAhead="2000"/>
    </Alignment>
  </Alignments>
</LandXML>`;

// Cuarto de círculo R=50 ccw: centro (x0,y50), de (0,0) a (50,50).
const quarterCurve = `<?xml version="1.0"?>
<LandXML>
  <Alignment name="ARC" staStart="0">
    <CoordGeom>
      <Curve rot="ccw" radius="50"><Start>0 0</Start><Center>50 0</Center><End>50 50</End></Curve>
    </CoordGeom>
  </Alignment>
</LandXML>`;

// Clotoide degenerada (radios INF ⇒ recta) hacia el PI, longitud 60.
const straightSpiral = `<?xml version="1.0"?>
<LandXML>
  <Alignment name="SP" staStart="0">
    <CoordGeom>
      <Spiral length="60" radiusStart="INF" radiusEnd="INF" rot="ccw" spiType="clothoid">
        <Start>0 0</Start><PI>0 30</PI><End>0 60</End>
      </Spiral>
    </CoordGeom>
  </Alignment>
</LandXML>`;

describe("§E2-4 import LandXML", () => {
  it("muestrea dos rectas y mide bien la longitud y los extremos", () => {
    const r = parseLandXML(twoLinesEq)!;
    expect(r).not.toBeNull();
    expect(r.staStart).toBe(1000);
    expect(r.length).toBeCloseTo(160, 3);
    const p0 = r.points[0];
    const pN = r.points[r.points.length - 1];
    expect(p0[0]).toBeCloseTo(0, 6); // x = easting inicial
    expect(p0[1]).toBeCloseTo(0, 6); // y = northing inicial
    expect(pN[0]).toBeCloseTo(160, 3); // avanza 160 m al este
    expect(pN[1]).toBeCloseTo(0, 6);
  });

  it("PkMap: staStart desplaza el PK y la ecuación introduce el salto", () => {
    const r = parseLandXML(twoLinesEq)!;
    expect(pkAt(r.pkMap, 0)).toBeCloseTo(1000, 6);
    expect(pkAt(r.pkMap, 50)).toBeCloseTo(1050, 6);
    // justo antes de la ecuación el PK "back" = 1100.
    expect(pkAt(r.pkMap, 100 - 1e-6)).toBeCloseTo(1100, 3);
    // en/ tras la ecuación arranca en 2000.
    expect(pkAt(r.pkMap, 100)).toBeCloseTo(2000, 6);
    expect(pkAt(r.pkMap, 130)).toBeCloseTo(2030, 6);
  });

  it("sAtPk invierte el PkMap (PK de proyecto → abscisa de arco)", () => {
    const r = parseLandXML(twoLinesEq)!;
    expect(sAtPk(r.pkMap, 1050)).toBeCloseTo(50, 6);
    expect(sAtPk(r.pkMap, 2030)).toBeCloseTo(130, 6);
  });

  it("sin mapa, pkAt/sAtPk son la identidad", () => {
    expect(pkAt(null, 42)).toBe(42);
    expect(sAtPk(undefined, 42)).toBe(42);
    expect(pkAt([], 7)).toBe(7);
  });

  it("Curve ccw: cuarto de círculo R=50, extremo y longitud correctos", () => {
    const r = parseLandXML(quarterCurve)!;
    const pN = r.points[r.points.length - 1];
    expect(pN[0]).toBeCloseTo(50, 2);
    expect(pN[1]).toBeCloseTo(50, 2);
    expect(r.length).toBeCloseTo((50 * Math.PI) / 2, 1); // ≈ 78.54
  });

  it("Spiral con radios INF degenera en recta hacia el PI", () => {
    const r = parseLandXML(straightSpiral)!;
    const pN = r.points[r.points.length - 1];
    expect(pN[0]).toBeCloseTo(60, 3); // recta al este 60 m
    expect(pN[1]).toBeCloseTo(0, 6);
    expect(r.length).toBeCloseTo(60, 3);
  });
});
