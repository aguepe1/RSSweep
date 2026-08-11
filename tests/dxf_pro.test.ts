// DXF pro (E4-2): capas normalizadas, relleno SOLID, etiquetas de PK/cotas, eje,
// obstáculos y marcadores de invasión; cabecera 999 con meta. Se valida por
// contenido y por round-trip con el propio parser (`parseDXF`).
import { describe, it, expect } from "vitest";
import engine, { type Track, type Vehicle } from "./_engine";
import type { ClashResult } from "../src/types";

function build(id: string): Track {
  return engine.TRACK_PRESETS.find((p) => p.id === id)!.build();
}
function veh(id: string): Vehicle {
  return structuredClone(engine.VEHICLE_PRESETS.find((p) => p.id === id)!.vehicle);
}

describe("writeDXF pro", () => {
  const track = build("r25");
  const kin = engine.defaultKin();
  kin.enabled = true;
  const sweep = engine.runSweep(track, veh("urbos5"), { step: 0.5, kin });
  const clash: ClashResult = {
    points: [],
    violations: [{ x: 10, y: 2, pk: 30, off: 1.8, margin: -0.05, viol: true }],
    minMargin: -0.05,
    minAt: { x: 10, y: 2, pk: 30, off: 1.8, margin: -0.05, viol: true },
    requiredMargin: 0.05,
    envelope: "cinematica",
  };
  const dxf = engine.writeDXF(track, sweep, {
    obstacles: [
      [
        [0, 5],
        [60, 5],
      ],
    ],
    clash,
    pkOf: (s) => s,
    hatch: true,
    meta: ["BARRIDO test", "hash deadbeef"],
  });

  it("es R12 con las capas normalizadas y la cabecera 999", () => {
    expect(dxf).toContain("AC1009");
    expect(dxf).toContain("999");
    expect(dxf).toContain("hash deadbeef");
    for (const layer of ["EJE", "HUELLA", "ENV_KIN", "OBSTACULOS", "INVASIONES", "PK", "COTAS"]) {
      expect(dxf, layer).toContain(layer);
    }
  });

  it("incluye relleno SOLID, etiquetas TEXT y marcadores CIRCLE", () => {
    expect(dxf).toContain("SOLID"); // relleno de huella (R12 sin HATCH)
    expect(dxf).toContain("TEXT"); // etiquetas de PK / cotas / margen
    expect(dxf).toContain("CIRCLE"); // marcador de invasión
    expect(dxf).toContain("PK 30.0"); // etiqueta de PK cada 10 m
    expect(dxf).toContain("mm"); // margen de invasión en mm
  });

  it("round-trip: el propio parser lo reimporta con las capas esperadas", () => {
    const pr = engine.parseDXF(dxf);
    // el parser propio ignora SOLID/TEXT/CIRCLE (puede avisar); lo que importa es
    // que reimporta las polilíneas con sus capas. La validación estricta es ezdxf (CI).
    expect(pr.chains.length).toBeGreaterThan(0);
    expect(pr.layers).toContain("EJE");
    expect(pr.layers).toContain("HUELLA");
  });
});
