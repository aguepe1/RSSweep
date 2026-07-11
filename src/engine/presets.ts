// PRESETS de trazado y vehículo para pruebas y arranque.
import type { TrackPreset, VehiclePreset } from "../types";
import { trackFromSegments } from "./track";
import { defaultJoint } from "./vehicle";

export const TRACK_PRESETS: TrackPreset[] = [
  {
    id: "r25",
    name: "1 · Curva R25 + clotoides (90°)",
    build: () =>
      trackFromSegments([
        ["straight", 20],
        ["clothoid", 10, 0, 1 / 25],
        ["arc", (25 * Math.PI) / 2, 1 / 25],
        ["clothoid", 10, 1 / 25, 0],
        ["straight", 20],
      ]),
  },
  {
    id: "loop",
    name: "2 · Bucle terminal R20 (250°)",
    build: () =>
      trackFromSegments([
        ["straight", 30],
        ["clothoid", 8, 0, 1 / 20],
        ["arc", (20 * 250 * Math.PI) / 180, 1 / 20],
        ["clothoid", 8, 1 / 20, 0],
        ["straight", 30],
      ]),
  },
  {
    id: "scurve",
    name: "3 · Contracurva en S (R30/R−30)",
    build: () =>
      trackFromSegments([
        ["straight", 15],
        ["clothoid", 8, 0, 1 / 30],
        ["arc", (30 * Math.PI) / 3, 1 / 30],
        ["clothoid", 8, 1 / 30, 0],
        ["straight", 6],
        ["clothoid", 8, 0, -1 / 30],
        ["arc", (30 * Math.PI) / 3, -1 / 30],
        ["clothoid", 8, -1 / 30, 0],
        ["straight", 15],
      ]),
  },
  {
    id: "chicane",
    name: "4 · Chicane R50 sin transiciones",
    build: () =>
      trackFromSegments([
        ["straight", 20],
        ["arc", (50 * 14 * Math.PI) / 180, 1 / 50],
        ["arc", (50 * 14 * Math.PI) / 180, -1 / 50],
        ["straight", 20],
      ]),
  },
  {
    id: "r100",
    name: "5 · Curva amplia R100 (45°)",
    build: () =>
      trackFromSegments([
        ["straight", 30],
        ["clothoid", 20, 0, 1 / 100],
        ["arc", (100 * Math.PI) / 4, 1 / 100],
        ["clothoid", 20, 1 / 100, 0],
        ["straight", 30],
      ]),
  },
  {
    // Horquilla de radio inviable (R1.5): ramas paralelas a 3 m unidas por un giro
    // de 180°. Fixture de estrés del remapeo por estaciones (E2-2): un vehículo
    // articulado largo ENVUELVE ambas ramas a la vez, de modo que la región barrida
    // es conexa y el ancho grande resultante es la doble ocupación real, no una
    // contaminación de remapeo. Ver docs/ENGINE_NOTES §3 y tests/fork.test.ts.
    id: "hairpin",
    name: "6 · Horquilla R1.5 (ramas a 3 m) — fixture",
    build: () =>
      trackFromSegments([
        ["straight", 20],
        ["arc", 1.5 * Math.PI, 1 / 1.5],
        ["straight", 20],
      ]),
  },
];

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: "urbos5",
    name: "5 módulos ~32 m (tipo Urbos 3 / Citadis 302)",
    vehicle: {
      wheelbase: 1.85,
      mirror: { enabled: true, protrusion: 0.25, length: 0.3, offsetFromFront: 0.55 },
      modules: [
        {
          id: "C1",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 2.3,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
        },
        { id: "S2", type: "suspendido", length: 6.15, width: 2.65 },
        {
          id: "C3",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 3.35,
          jointFrontOff: 0,
          jointRearOff: 0,
        },
        { id: "S4", type: "suspendido", length: 6.15, width: 2.65 },
        {
          id: "C5",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 4.4,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabRear: true,
        },
      ],
      joints: [defaultJoint(), defaultJoint(), defaultJoint(), defaultJoint()],
    },
  },
  {
    id: "tram3",
    name: "3 módulos ~24 m (bogie–susp.–bogie)",
    vehicle: {
      wheelbase: 1.8,
      mirror: { enabled: true, protrusion: 0.25, length: 0.3, offsetFromFront: 0.55 },
      modules: [
        {
          id: "C1",
          type: "bogie",
          length: 9.2,
          width: 2.4,
          pivotFromFront: 2.5,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
        },
        { id: "S2", type: "suspendido", length: 5.6, width: 2.4 },
        {
          id: "C3",
          type: "bogie",
          length: 9.2,
          width: 2.4,
          pivotFromFront: 6.7,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabRear: true,
        },
      ],
      joints: [defaultJoint(), defaultJoint()],
    },
  },
  {
    id: "tram7",
    name: "7 módulos ~43 m (tipo Urbos XL)",
    vehicle: {
      wheelbase: 1.85,
      mirror: { enabled: true, protrusion: 0.25, length: 0.3, offsetFromFront: 0.55 },
      modules: [
        {
          id: "C1",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 2.3,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
        },
        { id: "S2", type: "suspendido", length: 5.3, width: 2.65 },
        {
          id: "C3",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 3.35,
          jointFrontOff: 0,
          jointRearOff: 0,
        },
        { id: "S4", type: "suspendido", length: 5.3, width: 2.65 },
        {
          id: "C5",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 3.35,
          jointFrontOff: 0,
          jointRearOff: 0,
        },
        { id: "S6", type: "suspendido", length: 5.3, width: 2.65 },
        {
          id: "C7",
          type: "bogie",
          length: 6.7,
          width: 2.65,
          pivotFromFront: 4.4,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabRear: true,
        },
      ],
      joints: [
        defaultJoint(),
        defaultJoint(),
        defaultJoint(),
        defaultJoint(),
        defaultJoint(),
        defaultJoint(),
      ],
    },
  },
  {
    // E4-B2 · coche rígido sobre DOS bogies (cuerpo único de dos pivotes). Preset de
    // validación: L=14, ancho 2.55, pivotes a 2.50 y 11.50 (a=9.0), empate 1.85. Los
    // dorados analíticos en R25 están en docs/ENGINE_NOTES §4.4 / tests/bibogie.test.ts.
    id: "car2bogie",
    name: "Coche 2 bogies ~14 m (validación)",
    vehicle: {
      wheelbase: 1.85,
      mirror: { enabled: false, protrusion: 0, length: 0, offsetFromFront: 0 },
      modules: [
        {
          id: "K1",
          type: "biBogie",
          length: 14.0,
          width: 2.55,
          pivotFrontFromFront: 2.5,
          pivotRearFromFront: 11.5,
          wheelbase: 1.85,
          jointFrontOff: 0,
          jointRearOff: 0,
          cabFront: true,
          cabRear: true,
        },
      ],
      joints: [],
    },
  },
];
