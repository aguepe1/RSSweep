// Punto de carga del motor para los tests. Tras el port a TS (E1-2) apunta al
// barrel TS `src/engine`. Los mismos valores dorados que pasaban contra el
// engine.js original deben seguir en verde: esa es la validación del port.
import * as engine from "../src/engine/index";

export type {
  Track,
  Vehicle,
  VehicleModule,
  Joint,
  Mirror,
  KinRules,
  ChainSolution,
  Poly,
  SweepOpts,
  SweepResult,
  SweepSummary,
  ClashResult,
  UicParams,
  TrackPreset,
  VehiclePreset,
} from "../src/types";

export default engine;
