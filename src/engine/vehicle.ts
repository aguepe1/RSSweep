// VEHÍCULO — construcción, validación y defaults.
import type { Joint, KinRules, Vec2, Vehicle, VehicleModule } from "../types";

export function defaultJoint(): Joint {
  return { type: "libre", gap: 0.4, fuelleWidth: 2.0, maxAngleDeg: 45, stiffness: 10 };
}

/** Reglas simplificadas de envolvente cinemática (NO EN 15273 certificada). */
export function defaultKin(): KinRules {
  return {
    enabled: false,
    h: 1.6,
    e: 1.5,
    dMax: 0.12,
    rFull: 30,
    stopped: true,
    iMax: 0.1,
    sigma: 0.25,
    hRoll: 0.7,
    q: 0.035,
    tAlign: 0.02,
    tCant: 0.015,
  };
}

/** Garantiza que joints tenga longitud modules.length-1. */
export function syncJoints(v: Vehicle): Vehicle {
  if (!Array.isArray(v.joints)) v.joints = [];
  while (v.joints.length < v.modules.length - 1) v.joints.push(defaultJoint());
  v.joints.length = Math.max(0, v.modules.length - 1);
  return v;
}

export function validateVehicle(v: Vehicle): string[] {
  syncJoints(v);
  const errs: string[] = [];
  if (!v.modules.length) errs.push("Define al menos un modulo.");
  if (v.modules.length && v.modules[0].type !== "bogie")
    errs.push("El primer modulo debe ser de tipo bogie (pivote guiado).");
  if (v.modules.length && v.modules[v.modules.length - 1].type !== "bogie")
    errs.push("El ultimo modulo debe ser de tipo bogie.");
  v.modules.forEach((m, i) => {
    if (!(m.length > 0)) errs.push(`Modulo ${i + 1}: longitud invalida.`);
    if (!(m.width > 0)) errs.push(`Modulo ${i + 1}: ancho invalido.`);
    if (
      m.type === "bogie" &&
      !((m.pivotFromFront ?? -1) >= 0 && (m.pivotFromFront ?? -1) <= m.length)
    )
      errs.push(`Modulo ${i + 1}: el pivote debe estar dentro del modulo (0..longitud).`);
  });
  v.joints.forEach((j, i) => {
    if (j.type === "rigida" && v.modules[i + 1] && v.modules[i + 1].type === "bogie")
      errs.push(
        `Rotula R${i + 1}: una rotula rigida no puede conectar con un modulo bogie aguas abajo (el pivote guiado quedaria sobredeterminado).`,
      );
    if (
      j.type === "bisectriz" &&
      v.modules[i] &&
      v.modules[i + 1] &&
      v.modules[i].type === "bogie" &&
      v.modules[i + 1].type === "bogie"
    )
      errs.push(
        `Rotula R${i + 1}: la rotula bisectriz (bielas de centrado) requiere un modulo suspendido adyacente.`,
      );
  });
  return errs;
}

export function vehicleLength(v: Vehicle): number {
  return v.modules.reduce((a, m) => a + m.length, 0);
}

/**
 * Contorno rectangular por defecto de un módulo (E2-6). Puntos [x, y] en el marco
 * local: x = distancia longitudinal desde el frente (0..length), y = lateral (±hw).
 */
export function rectContour(m: VehicleModule): Vec2[] {
  const hw = m.width / 2;
  return [
    [0, hw],
    [0, -hw],
    [m.length, -hw],
    [m.length, hw],
  ];
}

/**
 * Contorno con testeros achaflanados (E2-6): corta las dos esquinas del extremo
 * indicado con un chaflán de profundidad `depth` (longitudinal) y `width` (lateral).
 * `front`/`rear` seleccionan qué extremos se achaflanan. Con ambos a `false`
 * devuelve el rectángulo. Los parámetros se recortan a [0, length/2] y [0, hw].
 */
export function chamferContour(
  m: VehicleModule,
  depth: number,
  width: number,
  front = true,
  rear = true,
): Vec2[] {
  const L = m.length;
  const hw = m.width / 2;
  const d = Math.max(0, Math.min(depth, L / 2));
  const w = Math.max(0, Math.min(width, hw));
  const pts: Vec2[] = [];
  // esquina frontal izquierda
  if (front) pts.push([d, hw], [0, hw - w]);
  else pts.push([0, hw]);
  // esquina frontal derecha
  if (front) pts.push([0, -(hw - w)], [d, -hw]);
  else pts.push([0, -hw]);
  // esquina trasera derecha
  if (rear) pts.push([L - d, -hw], [L, -(hw - w)]);
  else pts.push([L, -hw]);
  // esquina trasera izquierda
  if (rear) pts.push([L, hw - w], [L - d, hw]);
  else pts.push([L, hw]);
  return pts;
}
