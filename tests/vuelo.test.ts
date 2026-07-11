// ============================================================================
// E4-B3 — VALIDACIÓN de vuelos y empate (colocación del bogie dentro del coche).
// `vehicleWarnings` son AVISOS no bloqueantes (a diferencia de `validateVehicle`,
// que devuelve errores que impiden el barrido). Comprueban la geometría de
// colocación: el empate debe caber en el módulo y los ejes del bogie no deben
// sobresalir del cuerpo (vuelo = distancia del testero al eje más próximo; medido
// al EJE del bogie, de modo que vuelo_delantero + empate + vuelo_trasero = longitud
// para un módulo de un solo bogie). Es geometría de PRESENTACIÓN/entrada: no toca
// el motor ni los valores dorados.
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle } from "./_engine";

function bogieCar(over: Partial<Vehicle["modules"][number]> = {}): Vehicle {
  return {
    wheelbase: 1.85,
    modules: [
      {
        id: "C1",
        type: "bogie",
        length: 6.7,
        width: 2.65,
        pivotFromFront: 2.3,
        cabFront: true,
        cabRear: true,
        ...over,
      },
    ],
    joints: [],
  };
}

describe("E4-B3 · avisos de vuelo y empate", () => {
  it("un vehículo bien colocado no genera avisos", () => {
    // preset urbos5: todos los ejes caben en su módulo
    const v = engine.VEHICLE_PRESETS[0].vehicle as Vehicle;
    expect(engine.vehicleWarnings(v)).toEqual([]);
  });

  it("el preset «Coche 2 bogies» no genera avisos", () => {
    const v = engine.VEHICLE_PRESETS[3].vehicle as Vehicle;
    expect(engine.vehicleWarnings(v)).toEqual([]);
  });

  it("un pivote demasiado adelantado (eje delantero fuera del cuerpo) avisa de vuelo negativo", () => {
    // pivote a 0.5 m con empate 1.85 ⇒ eje delantero en 0.5−0.925 = −0.425 (< 0)
    const v = bogieCar({ pivotFromFront: 0.5 });
    const w = engine.vehicleWarnings(v);
    expect(w.length).toBeGreaterThan(0);
    expect(w.join(" ")).toMatch(/vuelo delantero negativo/i);
  });

  it("un pivote demasiado retrasado (eje trasero fuera del cuerpo) avisa de vuelo trasero negativo", () => {
    // pivote a 6.4 m con empate 1.85 ⇒ eje trasero en 6.4+0.925 = 7.325 (> 6.7)
    const v = bogieCar({ pivotFromFront: 6.4 });
    const w = engine.vehicleWarnings(v);
    expect(w.join(" ")).toMatch(/vuelo trasero negativo/i);
  });

  it("un empate mayor que la longitud del módulo avisa", () => {
    const v = bogieCar({ length: 1.5, pivotFromFront: 0.75, wheelbase: 2.0 });
    const w = engine.vehicleWarnings(v);
    expect(w.join(" ")).toMatch(/empate/i);
  });

  it("un empate no positivo avisa", () => {
    const v = bogieCar({ wheelbase: 0 });
    // wheelbase 0 en el módulo ⇒ cae al global (1.85), no avisa; forzamos global 0
    v.wheelbase = 0;
    const w = engine.vehicleWarnings(v);
    expect(w.join(" ")).toMatch(/empate/i);
  });

  it("los avisos no son errores: validateVehicle no los incluye (no bloquean)", () => {
    const v = bogieCar({ pivotFromFront: 0.5 }); // vuelo negativo pero pivote ∈ [0,L]
    // el pivote sigue dentro del módulo ⇒ validateVehicle no debe reportar error
    expect(engine.validateVehicle(v)).toEqual([]);
    // pero sí debe haber un aviso
    expect(engine.vehicleWarnings(v).length).toBeGreaterThan(0);
  });

  it("un biBogie con el eje del bogie trasero fuera del cuerpo avisa", () => {
    const v: Vehicle = {
      wheelbase: 1.85,
      modules: [
        {
          id: "K",
          type: "biBogie",
          length: 14,
          width: 2.55,
          pivotFrontFromFront: 2.5,
          pivotRearFromFront: 13.9, // eje trasero en 13.9+0.925 = 14.825 (> 14)
          wheelbase: 1.85,
          cabFront: true,
          cabRear: true,
        },
      ],
      joints: [],
    };
    expect(engine.vehicleWarnings(v).join(" ")).toMatch(/vuelo trasero negativo/i);
  });
});
