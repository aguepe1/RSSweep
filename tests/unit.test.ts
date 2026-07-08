// Tests unitarios de piezas críticas del motor.
import { describe, it, expect } from "vitest";
import { solveLin } from "../src/engine/chain";
import { interpTable, parseCantCSV } from "../src/engine/kinematic";

describe("solveLin (eliminación gaussiana con pivoteo) — trampa E1 #5 / ENGINE_NOTES §6", () => {
  it("resuelve un sistema 2x2 conocido", () => {
    // 2x + y = 5 ; x + 3y = 10 → x=1, y=3
    const x = solveLin(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(1, 10);
    expect(x![1]).toBeCloseTo(3, 10);
  });

  it("resuelve un 3x3 y verifica A·x = b", () => {
    const A = [
      [3, 2, -1],
      [2, -2, 4],
      [-1, 0.5, -1],
    ];
    const b = [1, -2, 0];
    const x = solveLin(
      A.map((r) => r.slice()),
      b.slice(),
    );
    expect(x).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      const dot = A[i][0] * x![0] + A[i][1] * x![1] + A[i][2] * x![2];
      expect(dot).toBeCloseTo(b[i], 9);
    }
  });

  it("devuelve null en sistema singular (no NaN silencioso)", () => {
    const x = solveLin(
      [
        [1, 2],
        [2, 4],
      ],
      [1, 2],
    );
    expect(x).toBeNull();
  });
});

describe("interpTable / parseCantCSV", () => {
  it("interpola linealmente y satura en los extremos", () => {
    const t: Array<[number, number]> = [
      [0, 0],
      [10, 1],
    ];
    expect(interpTable(t, -5)).toBeCloseTo(0, 12);
    expect(interpTable(t, 5)).toBeCloseTo(0.5, 12);
    expect(interpTable(t, 20)).toBeCloseTo(1, 12);
  });

  it("parsea CSV con ; , o tab y convierte mm→m", () => {
    const t = parseCantCSV("0;0\n10,120\n20\t60");
    expect(t).not.toBeNull();
    expect(t!.length).toBe(3);
    expect(t![1][1]).toBeCloseTo(0.12, 12);
  });

  it("rechaza CSV con menos de 2 filas válidas", () => {
    expect(parseCantCSV("basura\n0;10")).toBeNull();
  });
});
