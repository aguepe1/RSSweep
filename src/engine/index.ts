// Barrel del motor: API pública (equivalente al module.exports de engine.js).
export { trackFromSegments, trackFromPoints, makeTrack, reverseTrack } from "./track";
export { parseDXF, joinChains, obstaclesFromDXF, writeDXF } from "./dxf";
export { parseLandXML, pkAt, sAtPk } from "./landxml";
export {
  defaultJoint,
  defaultKin,
  syncJoints,
  validateVehicle,
  vehicleLength,
  rectContour,
  chamferContour,
} from "./vehicle";
export { solveChain, solveChainEq, solveLin, hasBisectriz, footprint } from "./chain";
export { runSweep } from "./sweep";
export { remapStations, envelopeRibbon } from "./envelope";
export { parseCantCSV, parseSpeedCSV, interpTable, kinStationAdd } from "./kinematic";
export { clashCheck } from "./clash";
export { uicParamsFromVehicle, uic505Profile } from "./uic";
export { buildReportData } from "./report-data";
export type { ReportData } from "./report-data";
export { TRACK_PRESETS, VEHICLE_PRESETS } from "./presets";
export * from "../types";
