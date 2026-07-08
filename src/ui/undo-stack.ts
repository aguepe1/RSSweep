// Pila de deshacer/rehacer genérica y pura (sin DOM). Guarda estados completos
// (snapshots) en lugar de comandos: es robusto frente a mutaciones arbitrarias
// del panel y trivial de razonar. Empujar un estado idéntico al actual es un
// no-op (evita entradas espurias cuando un `change` no cambia nada). Testeable
// de forma aislada (tests/undo.test.ts) sin arrancar la UI.

/** Compara dos estados por su serialización JSON (los snapshots son JSON-planos). */
function same<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class UndoStack<T> {
  private undo: T[] = [];
  private redo: T[] = [];
  private present: T;

  /** `cap` limita el histórico (descarta las entradas más antiguas). */
  constructor(
    initial: T,
    private readonly cap = 100,
  ) {
    this.present = initial;
  }

  /** Estado actual (la "presente" de la línea temporal). */
  get current(): T {
    return this.present;
  }

  get canUndo(): boolean {
    return this.undo.length > 0;
  }

  get canRedo(): boolean {
    return this.redo.length > 0;
  }

  /** Registra `next` como nuevo presente; ignora estados idénticos y purga el redo. */
  push(next: T): void {
    if (same(next, this.present)) return;
    this.undo.push(this.present);
    if (this.undo.length > this.cap) this.undo.shift();
    this.redo = [];
    this.present = next;
  }

  /** Retrocede un paso y devuelve el nuevo presente (o `null` si no hay histórico). */
  undoStep(): T | null {
    const prev = this.undo.pop();
    if (prev === undefined) return null;
    this.redo.push(this.present);
    this.present = prev;
    return this.present;
  }

  /** Avanza un paso deshecho y devuelve el nuevo presente (o `null`). */
  redoStep(): T | null {
    const next = this.redo.pop();
    if (next === undefined) return null;
    this.undo.push(this.present);
    this.present = next;
    return this.present;
  }
}
