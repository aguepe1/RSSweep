// Genera un DXF pro de muestra (E4-2) para validarlo con ezdxf en CI. Ejecuta el
// motor real (misma ruta que el export de la app). Uso: `tsx tools/gen_sample_dxf.ts [salida]`.
import { writeFileSync } from "node:fs";
import {
  clashCheck,
  defaultKin,
  runSweep,
  TRACK_PRESETS,
  VEHICLE_PRESETS,
  writeDXF,
} from "../src/engine/index";
import type { Chain } from "../src/types";

const track = TRACK_PRESETS.find((p) => p.id === "r25")!.build();
const vehicle = structuredClone(VEHICLE_PRESETS.find((p) => p.id === "urbos5")!.vehicle);
const kin = defaultKin();
kin.enabled = true;
const sweep = runSweep(track, vehicle, { step: 0.5, kin });
if (sweep.error) throw new Error(sweep.error);

const obstacles: Chain[] = [
  [
    [10, 2],
    [80, 2],
  ],
];
const clash = clashCheck(track, sweep, obstacles, 0.05);
const dxf = writeDXF(track, sweep, {
  obstacles,
  clash,
  pkOf: (s) => s,
  hatch: true,
  meta: ["BARRIDO — muestra de validación DXF pro (E4-2)"],
});

const out = process.argv[2] ?? "sample.dxf";
writeFileSync(out, dxf);
console.log(`wrote ${out} (${dxf.length} bytes)`);
