// ============================================================================
// E4-B1 — derivar eje (línea media) y ancho de vía de dos carriles.
//  · Dos rectas paralelas ⇒ eje en y=0 y gauge = separación exacta.
//  · Dos arcos concéntricos ⇒ eje al radio medio y gauge constante.
//  · Una sola polilínea ⇒ no hay dos carriles: axis/gauge null con aviso.
// railsToAxis NO toca los casos analíticos dorados (no interviene en la cadena
// ni en el barrido): sólo cambia de dónde SALE el eje al importar.
// ============================================================================
import { describe, it, expect } from "vitest";
import { railsToAxis } from "../src/engine/dxf";
import type { Chain } from "../src/types";

describe("E4-B1 · eje y ancho de vía de dos carriles", () => {
  it("dos rectas paralelas ⇒ eje en la línea media y gauge = separación", () => {
    const g = 1.435;
    const h = g / 2;
    const railA: Chain = [];
    const railB: Chain = [];
    for (let x = 0; x <= 20; x += 0.5) {
      railA.push([x, h]);
      railB.push([x, -h]);
    }
    const r = railsToAxis([railA, railB]);
    expect(r.axis).not.toBeNull();
    expect(r.gauge!).toBeCloseTo(g, 3);
    for (const p of r.axis!) expect(Math.abs(p[1])).toBeLessThan(1e-6);
  });

  it("carriles curvos concéntricos ⇒ eje al radio medio y gauge constante", () => {
    const R = 25;
    const g = 1.5;
    const h = g / 2;
    const railA: Chain = [];
    const railB: Chain = [];
    for (let a = 0; a <= Math.PI / 4; a += 0.02) {
      railA.push([(R + h) * Math.cos(a), (R + h) * Math.sin(a)]);
      railB.push([(R - h) * Math.cos(a), (R - h) * Math.sin(a)]);
    }
    const r = railsToAxis([railA, railB]);
    expect(r.gauge!).toBeCloseTo(g, 2);
    for (const p of r.axis!) expect(Math.hypot(p[0], p[1])).toBeCloseTo(R, 1);
  });

  it("una sola polilínea ⇒ no hay dos carriles (axis/gauge null)", () => {
    const one: Chain = [
      [0, 0],
      [10, 0],
    ];
    const r = railsToAxis([one]);
    expect(r.axis).toBeNull();
    expect(r.gauge).toBeNull();
    expect(r.warnings.join(" ")).toContain("dos carriles");
  });
});
