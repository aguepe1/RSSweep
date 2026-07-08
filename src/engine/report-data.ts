// REPORT-DATA — agrega resultados en una estructura serializable y estable,
// base para el reporting entregable (backlog E4). Sin dependencias de DOM.
import type { SweepResult, UicParams, Vehicle } from "../types";
import { vehicleLength } from "./vehicle";

export interface ReportData {
  version: string;
  vehicle: {
    length: number;
    nModules: number;
    maxWidth: number;
  };
  track: {
    length: number;
  };
  geo: {
    totalWidth: number;
    left: number;
    right: number;
  } | null;
  kin: {
    enabled: boolean;
    totalWidth: number;
    left: number;
    right: number;
  } | null;
  joints: Array<{ label: string; type: string; maxAngle: number; pk: number; exceeded: boolean }>;
  uic: UicParams | null;
}

export function buildReportData(
  version: string,
  vehicle: Vehicle,
  trackLength: number,
  sweep: SweepResult,
  uic: UicParams | null = null,
): ReportData {
  const s = sweep.summary;
  return {
    version,
    vehicle: {
      length: vehicleLength(vehicle),
      nModules: vehicle.modules.length,
      maxWidth: Math.max(...vehicle.modules.map((m) => m.width)),
    },
    track: { length: trackLength },
    geo: s ? { totalWidth: s.totalWidth, left: s.maxLeft, right: s.maxRight } : null,
    kin:
      s && s.kinEnabled
        ? { enabled: true, totalWidth: s.kinTotalWidth, left: s.kinMaxLeft, right: s.kinMaxRight }
        : null,
    joints: (sweep.joints ?? []).map((j) => ({
      label: j.label,
      type: j.type,
      maxAngle: j.maxAngle,
      pk: j.pk,
      exceeded: j.exceeded,
    })),
    uic,
  };
}
