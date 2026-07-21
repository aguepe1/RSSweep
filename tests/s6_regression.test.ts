// ============================================================================
// GUARDAS DE REGRESIÓN §6 — los dos tests derivados que la moraleja de
// docs/ENGINE_NOTES §6 prescribe EXPLÍCITAMENTE y que faltaban:
//
//  1. Solver de equilibrio (bisectriz): E_final < E_inicial SIEMPRE que haya lazo
//     libre y gradiente inicial no nulo (bug histórico `r[i][i]` en solveLin: el
//     Newton nunca aceptaba y devolvía la solución inicial sin error visible).
//  2. Módulo suspendido en círculo puro: el radio de su punto medio ≈ media de los
//     radios de sus articulaciones − sagitta de su cuerda (bug histórico del rumbo
//     A1→A2 invertido 180°: la huella salía +1.98 m hacia el EXTERIOR).
// ============================================================================
import { describe, it, expect } from "vitest";
import engine, { type Vehicle, type Track } from "./_engine";

function cloneVehicle(id: string): Vehicle {
  const preset = engine.VEHICLE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`vehicle preset ${id} not found`);
  return structuredClone(preset.vehicle);
}

describe("§6.1 solver de equilibrio — la energía SIEMPRE decrece", () => {
  // Bucle R20 con las cuatro rótulas en bisectriz k=50: hay lazo libre y el gradiente
  // inicial (configuración de cuerda libre) no es nulo, así que el equilibrio debe
  // reducir estrictamente el funcional de energía. Si el paso de Newton fuese NaN
  // (bug `r[i][i]`), energyFinal == energyInitial y este test caería.
  const track: Track = engine.TRACK_PRESETS.find((p) => p.id === "loop")!.build();
  const v = cloneVehicle("urbos5");
  for (const j of v.joints) {
    j.type = "bisectriz";
    j.stiffness = 50;
  }

  it("energyFinal < energyInitial en varias estaciones del arco", () => {
    let checked = 0;
    for (const s1 of [40, 50, 60, 70]) {
      const sol = engine.solveChainEq(track, v, s1, null);
      if (!sol) continue; // fuera de rango resoluble: se ignora, no invalida el test
      checked++;
      expect(sol.energyInitial, `E_inicial finita @s=${s1}`).toBeTypeOf("number");
      expect(sol.energyFinal, `E_final finita @s=${s1}`).toBeTypeOf("number");
      expect(Number.isFinite(sol.energyInitial!)).toBe(true);
      expect(Number.isFinite(sol.energyFinal!)).toBe(true);
      // hay algo que optimizar (gradiente inicial no nulo)
      expect(sol.energyInitial!, `E_inicial>0 @s=${s1}`).toBeGreaterThan(1e-6);
      // la moraleja §6: el equilibrio reduce ESTRICTAMENTE la energía
      expect(sol.energyFinal!, `E_final<E_inicial @s=${s1}`).toBeLessThan(sol.energyInitial!);
    }
    expect(checked, "al menos una estación resoluble").toBeGreaterThan(0);
  });
});

describe("§6.2 módulo suspendido — el punto medio se hunde hacia el interior", () => {
  // Círculo puro R=25 (recta de entrada + arco largo) y vehículo bogie–suspendido–
  // bogie: el módulo suspendido es una cuerda rígida entre articulaciones. Su punto
  // medio debe quedar DENTRO de la curva (radio < radio de las articulaciones), a la
  // sagitta de la cuerda. El bug histórico (rumbo invertido) lo mandaba al EXTERIOR.
  const R = 25;
  const track: Track = engine.trackFromSegments([
    ["straight", 30],
    ["arc", R * Math.PI * 1.6, 1 / R],
  ]);
  const v = cloneVehicle("tram3"); // C1(bogie) · S2(suspendido) · C3(bogie)
  const suspIdx = v.modules.findIndex((m) => m.type === "suspendido");

  it("radio del punto medio ≈ media de radios de articulación − sagitta, y hacia dentro", () => {
    const s1 = 80; // frente bien dentro del arco: todo el vehículo sobre el círculo
    const sol = engine.solveChain(track, v, s1, null);
    expect(sol, "cadena resoluble").not.toBeNull();

    // Centro del círculo: a R por la normal (+90° del rumbo) desde un punto del arco.
    const sC = 80;
    const p = track.pos(sC);
    const th = track.heading(sC);
    const C: [number, number] = [
      p[0] + R * Math.cos(th + Math.PI / 2),
      p[1] + R * Math.sin(th + Math.PI / 2),
    ];
    const rad = (q: [number, number]): number => Math.hypot(q[0] - C[0], q[1] - C[1]);

    const pose = sol!.poses[suspIdx];
    const L = v.modules[suspIdx].length;
    const dir: [number, number] = [Math.cos(pose.theta), Math.sin(pose.theta)];
    const A1: [number, number] = [pose.front[0], pose.front[1]]; // articulación delantera
    const A2: [number, number] = [A1[0] - L * dir[0], A1[1] - L * dir[1]]; // trasera
    const M: [number, number] = [A1[0] - (L / 2) * dir[0], A1[1] - (L / 2) * dir[1]]; // punto medio

    const rA1 = rad(A1);
    const rA2 = rad(A2);
    const rM = rad(M);
    const chord = Math.hypot(A1[0] - A2[0], A1[1] - A2[1]);
    const rm = (rA1 + rA2) / 2;
    const expectedMid = Math.sqrt(rm * rm - (chord / 2) * (chord / 2)); // = rm − sagitta

    // Propiedad de signo (la que rompía el bug 180°): el punto medio va HACIA DENTRO.
    expect(rM, "punto medio dentro de A1").toBeLessThan(rA1);
    expect(rM, "punto medio dentro de A2").toBeLessThan(rA2);
    // Identidad geométrica de la cuerda (tolerancia 5 mm).
    expect(Math.abs(rM - expectedMid), `rM=${rM} vs esperado=${expectedMid}`).toBeLessThan(0.005);
  });
});
