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
  const guided = (m: (typeof v.modules)[number]): boolean =>
    m.type === "bogie" || m.type === "biBogie";
  if (!v.modules.length) errs.push("Define al menos un modulo.");
  if (v.modules.length && !guided(v.modules[0]))
    errs.push("El primer modulo debe ser guiado (bogie o coche de dos bogies).");
  if (v.modules.length && !guided(v.modules[v.modules.length - 1]))
    errs.push("El ultimo modulo debe ser guiado (bogie o coche de dos bogies).");
  v.modules.forEach((m, i) => {
    if (!(m.length > 0)) errs.push(`Modulo ${i + 1}: longitud invalida.`);
    if (!(m.width > 0)) errs.push(`Modulo ${i + 1}: ancho invalido.`);
    if (
      m.type === "bogie" &&
      !((m.pivotFromFront ?? -1) >= 0 && (m.pivotFromFront ?? -1) <= m.length)
    )
      errs.push(`Modulo ${i + 1}: el pivote debe estar dentro del modulo (0..longitud).`);
    if (m.type === "biBogie") {
      const pf = m.pivotFrontFromFront ?? -1;
      const pr = m.pivotRearFromFront ?? -1;
      if (!(pf >= 0 && pf <= m.length && pr >= 0 && pr <= m.length))
        errs.push(`Modulo ${i + 1}: los dos pivotes deben estar dentro del modulo (0..longitud).`);
      else if (!(pr - pf >= 1.0))
        errs.push(
          `Modulo ${i + 1}: el pivote trasero debe estar al menos 1.0 m detras del delantero.`,
        );
    }
  });
  v.joints.forEach((j, i) => {
    if (j.type === "rigida" && v.modules[i + 1] && guided(v.modules[i + 1]))
      errs.push(
        `Rotula R${i + 1}: una rotula rigida no puede conectar con un modulo guiado aguas abajo (el pivote guiado quedaria sobredeterminado).`,
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

/**
 * Avisos NO bloqueantes sobre la colocación del bogie dentro del coche (E4-B3):
 * el empate debe caber en el módulo y los ejes del bogie no deben sobresalir del
 * cuerpo. El «vuelo» se mide del testero al EJE más próximo del bogie
 * (vuelo = pivote ∓ empate/2 respecto al extremo), de modo que para un módulo de
 * un solo bogie vuelo_delantero + empate + vuelo_trasero = longitud. Un vuelo
 * negativo significa que la rodadura queda fuera de la caja: es físicamente
 * imposible pero NO impide el cálculo (a diferencia de `validateVehicle`), por eso
 * es un aviso. Es geometría de entrada: no afecta a la envolvente ni a los dorados.
 */
export function vehicleWarnings(v: Vehicle): string[] {
  const warns: string[] = [];
  v.modules.forEach((m, i) => {
    if (m.type !== "bogie" && m.type !== "biBogie") return;
    const p = m.wheelbase || v.wheelbase || 0;
    if (!(p > 0)) {
      warns.push(`Modulo ${i + 1}: el empate debe ser positivo.`);
      return;
    }
    if (p > m.length)
      warns.push(`Modulo ${i + 1}: el empate (${p.toFixed(2)} m) supera la longitud del modulo.`);
    // pivotes que definen los ejes: uno (bogie) o dos (biBogie)
    const front = m.type === "biBogie" ? (m.pivotFrontFromFront ?? 0) : (m.pivotFromFront ?? 0);
    const rear = m.type === "biBogie" ? (m.pivotRearFromFront ?? 0) : (m.pivotFromFront ?? 0);
    if (front - p / 2 < -1e-9)
      warns.push(
        `Modulo ${i + 1}: vuelo delantero negativo (el eje delantero del bogie sobresale del cuerpo).`,
      );
    if (m.length - rear - p / 2 < -1e-9)
      warns.push(
        `Modulo ${i + 1}: vuelo trasero negativo (el eje trasero del bogie sobresale del cuerpo).`,
      );
  });
  return warns;
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
