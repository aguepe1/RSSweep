// ============================================================================
// E4-B4 — barrido de TRAVESÍA COMPLETA (entrada→salida) y extrapolación tangente.
// Por defecto el barrido solo cubre el tramo con el vehículo ÍNTEGRAMENTE dentro
// del trazado (rango [Lveh+1, longitud−1]); con `fullTraversal` cubre desde que el
// frente entra (s1=0) hasta que la cola sale (s1=longitud+Lveh). Más allá de los
// extremos el eje se prolonga en línea recta con el rumbo del extremo (tangente).
// El modo por defecto NO cambia: los 19 valores dorados quedan intactos (es opt-in).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";

function cloneVehicle(id: string): Vehicle {
  const p = engine.VEHICLE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error("preset " + id);
  return JSON.parse(JSON.stringify(p.vehicle));
}

describe("E4-B4 · extrapolación tangente del eje", () => {
  it("por defecto (extend=false) el eje se recorta a [0, longitud]", () => {
    // recta de 20 m sobre el eje X: s=[0,20], puntos [0..20]
    const s = new Float64Array([0, 20]);
    const x = new Float64Array([0, 20]);
    const y = new Float64Array([0, 0]);
    const t = engine.makeTrack(s, x, y);
    expect(t.pos(-5)[0]).toBeCloseTo(0, 9); // recortado al inicio
    expect(t.pos(25)[0]).toBeCloseTo(20, 9); // recortado al final
  });

  it("con extend=true el eje se prolonga recto (tangente) fuera del rango", () => {
    const s = new Float64Array([0, 20]);
    const x = new Float64Array([0, 20]);
    const y = new Float64Array([0, 0]);
    const t = engine.makeTrack(s, x, y, true);
    expect(t.pos(-5)[0]).toBeCloseTo(-5, 9); // prolongado antes del inicio
    expect(t.pos(-5)[1]).toBeCloseTo(0, 9);
    expect(t.pos(25)[0]).toBeCloseTo(25, 9); // prolongado tras el final
    expect(t.pos(25)[1]).toBeCloseTo(0, 9);
  });
});

describe("E4-B4 · barrido de travesía completa (opt-in)", () => {
  it("fullTraversal añade pasos de entrada/salida (más pasos que el rango por defecto)", () => {
    const track = engine.TRACK_PRESETS[0].build(); // R25 + clotoides
    const v = cloneVehicle("urbos5");
    const def = engine.runSweep(track, v, { step: 0.5 });
    const full = engine.runSweep(track, v, { step: 0.5, fullTraversal: true });
    if (def.error || full.error) throw new Error(def.error || full.error);
    expect(full.summary!.nSteps).toBeGreaterThan(def.summary!.nSteps);
  });

  it("cubrir la entrada/salida solo puede ampliar (o igualar) el ancho total", () => {
    const track = engine.TRACK_PRESETS[0].build();
    const v = cloneVehicle("urbos5");
    const def = engine.runSweep(track, v, { step: 0.5 });
    const full = engine.runSweep(track, v, { step: 0.5, fullTraversal: true });
    if (def.error || full.error) throw new Error(def.error || full.error);
    // la envolvente es el máximo por estación sobre más pasos ⇒ monótona no decreciente
    expect(full.summary!.totalWidth).toBeGreaterThanOrEqual(def.summary!.totalWidth - 1e-6);
  });

  it("en trazado recto la travesía no ensancha (el vehículo va recto en todo el recorrido)", () => {
    const s = new Float64Array([0, 60]);
    const x = new Float64Array([0, 60]);
    const y = new Float64Array([0, 0]);
    // trackFromPoints densifica; construyo recto con makeTrack directo densificado
    const N = 61;
    const ss = new Float64Array(N);
    const xx = new Float64Array(N);
    const yy = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      ss[i] = i;
      xx[i] = i;
      yy[i] = 0;
    }
    void s;
    void x;
    void y;
    const track = engine.makeTrack(ss, xx, yy);
    const v = cloneVehicle("urbos5");
    const def = engine.runSweep(track, v, { step: 0.5 });
    const full = engine.runSweep(track, v, { step: 0.5, fullTraversal: true });
    if (def.error || full.error) throw new Error(def.error || full.error);
    expect(full.summary!.totalWidth).toBeCloseTo(def.summary!.totalWidth, 3);
  });
});
