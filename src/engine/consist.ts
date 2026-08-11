// CONSIST — dos trenes acoplados en una sola cadena cinemática (A ▸ enganche ▸ B).
//
// El enganche (coupler) se modela como una BARRA rígida (drawbar): un módulo
// suspendido de longitud `coupler.length` y ancho `coupler.width`, flanqueado por
// dos rótulas `coupler:true`. El tipo de enganche escoge la clase cinemática de esas
// rótulas — articulado/automático → `libre` (pivotes libres); rígido/centrado →
// `bisectriz` con `stiffness` (barra centrada) — y `maxAngleDeg` es el límite de giro
// por rótula. Así el acople reutiliza EXACTAMENTE el patrón bogie–suspendido–bogie ya
// validado por los valores dorados: `buildConsist` es puro y NO toca el solver.
import type { Coupler, Joint, JointType, Vehicle, VehicleModule } from "../types";

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/** Enganche por defecto: barra articulada de 1 m, ±20° por rótula. */
export function defaultCoupler(): Coupler {
  return { type: "articulado", length: 1.0, width: 0.3, maxAngleDeg: 20, stiffness: 10 };
}

/** Hornea el empate por módulo con el global de su vehículo (para no perderlo al unir). */
function bakeWheelbase(v: Vehicle): void {
  for (const m of v.modules) {
    if ((m.type === "bogie" || m.type === "biBogie") && m.wheelbase == null) {
      m.wheelbase = v.wheelbase;
    }
  }
}

/**
 * Une el tren `a` (delantero) y `b` (trasero) por un enganche `coupler` en un único
 * Vehicle. Cabinas: la delantera de A y la trasera de B siguen siendo testeros de
 * cabina; los testeros acoplados dejan de serlo. Devuelve una copia (no muta A ni B).
 */
export function buildConsist(a: Vehicle, b: Vehicle, coupler: Coupler): Vehicle {
  const A = clone(a);
  const B = clone(b);
  bakeWheelbase(A);
  bakeWheelbase(B);

  A.modules.forEach((m, i) => {
    m.cabFront = i === 0;
    m.cabRear = false; // testero trasero de A: acoplado, sin cabina
  });
  B.modules.forEach((m, i) => {
    m.cabFront = false; // testero delantero de B: acoplado, sin cabina
    m.cabRear = i === B.modules.length - 1;
  });

  const bar: VehicleModule = {
    id: "⇄",
    type: "suspendido",
    length: Math.max(0.1, coupler.length),
    width: Math.max(0.05, coupler.width),
    jointFrontOff: 0,
    jointRearOff: 0,
  };
  const jType: JointType = coupler.type === "rigido" ? "bisectriz" : "libre";
  const couplerJoint = (): Joint => ({
    type: jType,
    gap: 0,
    fuelleWidth: coupler.width,
    maxAngleDeg: coupler.maxAngleDeg,
    stiffness: coupler.stiffness,
    coupler: true,
  });

  return {
    wheelbase: A.wheelbase,
    mirror: A.mirror ?? B.mirror,
    modules: [...A.modules, bar, ...B.modules],
    joints: [...A.joints, couplerJoint(), couplerJoint(), ...B.joints],
  };
}
