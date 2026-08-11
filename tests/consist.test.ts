// ============================================================================
// DOS TRENES ACOPLADOS (consist + enganche). `buildConsist` une A ▸ barra ▸ B
// reutilizando el patrón bogie–suspendido–bogie; no cambia el motor ni los dorados
// (cubiertos por golden.test). Aquí se valida el ensamblaje, la invariante en recta
// (dos trenes iguales acoplados barren lo mismo que uno) y la articulación en curva.
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";

function cloneVehicle(id: string): Vehicle {
  const preset = engine.VEHICLE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`vehicle preset ${id} not found`);
  return structuredClone(preset.vehicle);
}

describe("buildConsist — ensamblaje", () => {
  it("une A ▸ barra ▸ B con el recuento y las cabinas correctos", () => {
    const a = cloneVehicle("urbos5");
    const b = cloneVehicle("urbos5");
    const c = engine.buildConsist(a, b, engine.defaultCoupler());
    // módulos = A + barra + B ; rótulas = módulos − 1
    expect(c.modules.length).toBe(a.modules.length + 1 + b.modules.length);
    expect(c.joints.length).toBe(c.modules.length - 1);
    // barra de enganche en el centro, suspendida
    const bar = c.modules[a.modules.length];
    expect(bar.type).toBe("suspendido");
    expect(bar.id).toBe("⇄");
    // cabinas: solo delantera de A y trasera de B
    expect(c.modules[0].cabFront).toBe(true);
    expect(c.modules[c.modules.length - 1].cabRear).toBe(true);
    expect(c.modules[a.modules.length - 1].cabRear).toBe(false); // testero acoplado de A
    expect(c.modules[a.modules.length + 1].cabFront).toBe(false); // testero acoplado de B
    // dos rótulas de enganche marcadas coupler
    expect(c.joints.filter((j) => j.coupler).length).toBe(2);
    // no muta las entradas
    expect(a.modules.length).toBe(5);
  });

  it("el enganche rígido usa rótulas bisectriz; el articulado, libres", () => {
    const a = cloneVehicle("tram3");
    const artic = engine.buildConsist(a, cloneVehicle("tram3"), {
      type: "articulado",
      length: 1,
      width: 0.3,
      maxAngleDeg: 20,
      stiffness: 10,
    });
    expect(artic.joints.filter((j) => j.coupler).every((j) => j.type === "libre")).toBe(true);
    const rigid = engine.buildConsist(a, cloneVehicle("tram3"), {
      type: "rigido",
      length: 1,
      width: 0.3,
      maxAngleDeg: 5,
      stiffness: 80,
    });
    expect(rigid.joints.filter((j) => j.coupler).every((j) => j.type === "bisectriz")).toBe(true);
  });
});

describe("consist — comportamiento del barrido", () => {
  it("en recta, dos trenes iguales acoplados barren lo mismo que uno", () => {
    const track = engine.trackFromSegments([["straight", 140]]);
    const one = cloneVehicle("urbos5");
    const swOne = engine.runSweep(track, one, { step: 0.5 });
    const consist = engine.buildConsist(
      cloneVehicle("urbos5"),
      cloneVehicle("urbos5"),
      engine.defaultCoupler(),
    );
    const swTwo = engine.runSweep(track, consist, { step: 0.5 });
    expect(swOne.error).toBeUndefined();
    expect(swTwo.error).toBeUndefined();
    // en recta no hay sobreancho: ambos anchos ≈ ancho de caja
    expect(swTwo.summary!.totalWidth).toBeCloseTo(swOne.summary!.totalWidth, 3);
  });

  it("en curva R25 el enganche articula (ángulo > 0) y el barrido no falla", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const consist = engine.buildConsist(
      cloneVehicle("urbos5"),
      cloneVehicle("urbos5"),
      engine.defaultCoupler(),
    );
    const sw = engine.runSweep(track, consist, { step: 0.3 });
    expect(sw.error).toBeUndefined();
    const couplerJoints = sw.joints!.filter((j) => j.label.includes("⇄"));
    expect(couplerJoints.length).toBe(2);
    expect(Math.max(...couplerJoints.map((j) => j.maxAngle))).toBeGreaterThan(0.1);
    // la envolvente es finita y con sobreancho respecto a la caja
    expect(Number.isFinite(sw.summary!.totalWidth)).toBe(true);
    expect(sw.summary!.totalWidth).toBeGreaterThan(2 * sw.summary!.bodyHalfWidth);
  });

  it("footprint del consist NO dibuja fuelle en las rótulas de enganche", () => {
    const track = engine.TRACK_PRESETS.find((p) => p.id === "r25")!.build();
    const consist = engine.buildConsist(
      cloneVehicle("urbos5"),
      cloneVehicle("urbos5"),
      engine.defaultCoupler(),
    );
    const chain = engine.solveChainEq(track, consist, 70, null);
    expect(chain).not.toBeNull();
    const polys = engine.footprint(consist, chain!);
    const fuelles = polys.filter((p) => p.kind === "fuelle").length;
    // 4 fuelles por tren (5 módulos) × 2 = 8; las 2 rótulas de enganche no aportan
    expect(fuelles).toBe(8);
  });
});
