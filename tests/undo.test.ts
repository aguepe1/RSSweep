import { describe, expect, it } from "vitest";
import { UndoStack } from "../src/ui/undo-stack";

// E3-4 · pila de deshacer/rehacer: propiedades de la estructura pura (sin DOM).

describe("E3-4 · UndoStack", () => {
  it("50 operaciones + 50 deshacer devuelven el estado inicial", () => {
    const initial = { n: 0, tag: "base" };
    const s = new UndoStack(initial, 1000);
    let rng = 123456789;
    const rand = (): number => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };
    for (let i = 0; i < 50; i++) s.push({ n: i + 1, tag: `op${Math.floor(rand() * 1e6)}` });
    for (let i = 0; i < 50; i++) s.undoStep();
    expect(s.current).toEqual(initial);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(true);
  });

  it("empujar un estado idéntico es un no-op (sin entrada espuria)", () => {
    const s = new UndoStack({ v: 1 });
    s.push({ v: 1 });
    expect(s.canUndo).toBe(false);
    s.push({ v: 2 });
    expect(s.canUndo).toBe(true);
    s.push({ v: 2 });
    expect(s.undoStep()).toEqual({ v: 1 });
  });

  it("rehacer reproduce el estado deshecho; una nueva rama purga el redo", () => {
    const s = new UndoStack({ v: 0 });
    s.push({ v: 1 });
    s.push({ v: 2 });
    expect(s.undoStep()).toEqual({ v: 1 });
    expect(s.redoStep()).toEqual({ v: 2 });
    s.undoStep(); // → v:1
    s.push({ v: 9 }); // nueva rama
    expect(s.canRedo).toBe(false);
    expect(s.redoStep()).toBeNull();
  });

  it("respeta el tope de histórico descartando lo más antiguo", () => {
    const s = new UndoStack({ v: 0 }, 3);
    for (let i = 1; i <= 10; i++) s.push({ v: i });
    let steps = 0;
    while (s.undoStep()) steps++;
    expect(steps).toBe(3); // solo se conservan las 3 últimas transiciones
  });
});
