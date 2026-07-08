// ============================================================================
// Tipos compartidos del motor y la UI.
// Unidades internas SIEMPRE en metros y radianes (ver CLAUDE.md).
// ============================================================================

/** Punto o vector 2D en el plano de vía [x, y] (m). */
export type Vec2 = [number, number];

// ---------------------------------------------------------------------- TRACK
/** Curva paramétrica del eje por longitud de arco s. */
export interface Track {
  readonly s: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly n: number;
  readonly length: number;
  /** Posición en el eje a la abscisa s (recortada al rango). */
  pos(s: number): Vec2;
  /** Rumbo por diferencia finita ±0.25 m. */
  heading(s: number): number;
  /** Rumbo de la cuerda de longitud `base` centrada en s. */
  secantHeading(s: number, base: number): number;
}

/** Segmento de curvatura para `trackFromSegments`. */
export type TrackSegment =
  ["straight", number] | ["arc", number, number] | ["clothoid", number, number, number];

/**
 * Mapa de PK de proyecto (E2-4). Puntos de control ordenados por abscisa de arco
 * `s` (m desde el inicio del eje). Entre puntos consecutivos el PK avanza 1:1 con
 * la distancia: `pk = cp.pk + (s − cp.s)`. `staStart` inserta el primer punto en
 * s=0 y las ecuaciones de PK (`StaEquation`) añaden puntos con salto de valor.
 * Vacío/ausente ⇒ identidad (pk = s).
 */
export type PkMap = Array<{ s: number; pk: number }>;

/** Resultado del import de un alignment LandXML (E2-4). */
export interface LandXMLResult {
  points: Vec2[];
  pkMap: PkMap;
  staStart: number;
  length: number;
  name: string;
  warnings: string[];
}

// -------------------------------------------------------------------- VEHÍCULO
export type ModuleType = "bogie" | "suspendido";
export type BogieType = "rigido";

export interface VehicleModule {
  id?: string;
  type: ModuleType;
  /** Sólo bogie: "rigido" fuerza rumbo secante y anclaje en cuerda del empate. */
  bogieType?: BogieType;
  length: number;
  width: number;
  /** Sólo bogie: posición del pivote medida desde el frente del módulo. */
  pivotFromFront?: number;
  /** Empate propio del bogie (m); si falta usa `Vehicle.wheelbase`. */
  wheelbase?: number;
  jointFrontOff?: number;
  jointRearOff?: number;
  cabFront?: boolean;
  cabRear?: boolean;
  /**
   * Contorno 2D del cuerpo en el marco local del módulo (E2-6): lista cerrada de
   * puntos [x, y] en metros, con x = distancia longitudinal desde el frente F
   * hacia atrás (0..length) e y = desplazamiento lateral (+ hacia la normal, izq).
   * Si falta, se usa el rectángulo por defecto (con retranqueo gap/2 en testeros
   * articulados). Permite testeros achaflanados/curvos (presets rectángulo/chaflán).
   */
  contour?: Vec2[];
}

export type JointType = "libre" | "rigida" | "bisectriz";

export interface Joint {
  type: JointType;
  gap: number;
  fuelleWidth: number;
  maxAngleDeg: number;
  stiffness: number;
}

export interface Mirror {
  enabled: boolean;
  protrusion: number;
  length: number;
  offsetFromFront: number;
}

export interface Vehicle {
  wheelbase: number;
  mirror?: Mirror;
  modules: VehicleModule[];
  joints: Joint[];
}

// -------------------------------------------------------------- CINEMÁTICA/KIN
/** Reglas cuasi-estáticas simplificadas (NO EN 15273 certificada). */
export interface KinRules {
  enabled: boolean;
  h: number;
  e: number;
  dMax: number;
  rFull: number;
  stopped: boolean;
  iMax: number;
  sigma: number;
  hRoll: number;
  q: number;
  tAlign: number;
  tCant: number;
  /** Tabla de peralte real [[pk, D_m], ...] (opcional, tiene prioridad). */
  cantTable?: CantTable;
  /**
   * Perfil de velocidad real [[pk, v_ms], ...] (opcional, E2-7). Si está presente,
   * la insuficiencia de peralte se calcula I(s) = B·v(s)²·k(s) − D(s) con B = e/g,
   * en vez del escalado heurístico por curvatura (iMax·c). El exceso de peralte
   * (vehículo detenido/lento) es max(0, −I).
   */
  speedTable?: SpeedTable;
}

/** Tabla de peralte: pares [pk (m), D (m)] ordenados por pk. */
export type CantTable = Array<[number, number]>;

/** Perfil de velocidad: pares [pk (m), v (m/s)] ordenados por pk. */
export type SpeedTable = Array<[number, number]>;

// ------------------------------------------------------------------ CADENA/POS
export interface ModulePose {
  front: Vec2;
  theta: number;
  secant?: number;
  rigid?: boolean;
}

export interface ChainSolution {
  poses: ModulePose[];
  sPivots: number[];
  jointAngles: number[];
  jointPts: Vec2[];
  secants: number[];
  yaws?: number[];
}

export interface WarmStart {
  yaws: number[] | null;
  sPivots: number[];
}

export type PolyKind = "body" | "fuelle" | "mirror";
export interface Poly {
  kind: PolyKind;
  pts: Vec2[];
}

// -------------------------------------------------------------------- BARRIDO
export interface SweepOpts {
  step?: number;
  stationStep?: number;
  edgeStep?: number;
  sStart?: number;
  sEnd?: number;
  kin?: KinRules;
  /**
   * Analiza también el sentido de marcha inverso y une las envolventes (E2-5).
   * Vehículos asimétricos y trazados con contracurvas dan huellas distintas por
   * sentido; la geometría/kin resultante es la unión de ambos sentidos.
   */
  both?: boolean;
  /**
   * Progreso del barrido en [0,1] por PK resuelto. No afecta al resultado
   * numérico (los valores dorados son invariantes); sirve para reportar avance
   * desde un Web Worker. Se invoca de forma síncrona dentro del bucle.
   */
  onProgress?: (frac: number) => void;
}

export interface Stations {
  stS: Float64Array;
  stX: Float64Array;
  stY: Float64Array;
  stNx: Float64Array;
  stNy: Float64Array;
}

export interface SweepStep {
  s1: number;
  chain: ChainSolution;
  polys: Poly[];
}

/** Huella de un paso con su abscisa de pivote (entrada del remapeo E2-2). */
export interface StepFootprint {
  s1: number;
  polys: Poly[];
}

/** Fila del perfil: [s, dchaGeo, izqGeo, kIdx, dchaKin, izqKin]. */
export type ProfileRow = [number, number, number, number, number, number];

export interface JointResult {
  idx: number;
  label: string;
  type: JointType;
  maxAngle: number;
  pk: number;
  limit: number;
  exceeded: boolean;
}

export interface SweepSummary {
  bodyHalfWidth: number;
  maxLeft: number;
  sMaxLeft: number;
  maxRight: number;
  sMaxRight: number;
  totalWidth: number;
  kinEnabled: boolean;
  kinMaxLeft: number;
  kinMaxRight: number;
  kinTotalWidth: number;
  nSteps: number;
  /** true si la envolvente une ida y vuelta (E2-5). */
  bidirectional: boolean;
}

export interface SweepResult {
  steps?: SweepStep[];
  rows?: ProfileRow[];
  stations?: Stations;
  joints?: JointResult[];
  summary?: SweepSummary;
  /**
   * Contorno maestro del barrido (E2-2): cinta cerrada de la envolvente derivada
   * del remapeo de la unión a estaciones (+N de ida, −N de vuelta). Los perfiles
   * por PK provienen del mismo remapeo. Ausente si el barrido falla.
   */
  envelope?: Vec2[];
  /**
   * Sentido de marcha que gobierna el ancho de cada fila de `rows` (E2-5):
   * 0 = sentido de dibujo (ida), 1 = sentido inverso (vuelta). Alineado 1:1 con
   * `rows`. Ausente si el barrido no es bidireccional.
   */
  rowDir?: Uint8Array;
  error?: string;
}

// ------------------------------------------------------------------ OBSTÁCULOS
export type Chain = Vec2[];

export interface ClashPoint {
  x: number;
  y: number;
  pk: number;
  off: number;
  margin: number;
  viol: boolean;
}

export interface ClashResult {
  points: ClashPoint[];
  violations: ClashPoint[];
  minMargin: number | null;
  minAt: ClashPoint | null;
  requiredMargin: number;
  envelope: "cinematica" | "geometrica";
}

// -------------------------------------------------------------------- UIC 505
export interface UicParams {
  a: number;
  na: number;
  p: number;
  b: number;
}

// ---------------------------------------------------------------------- DXF
export interface DXFParseResult {
  chains: Chain[];
  warnings: string[];
  /** Capa (código 8) de cada cadena, en paralelo a `chains` (E2-3). */
  chainLayers?: string[];
  /** Capas distintas con geometría, ordenadas (para selección de eje, E2-3). */
  layers?: string[];
  /** Unidades de dibujo detectadas por $INSUNITS y factor a metros (E2-3). */
  units?: { code: number; name: string; scale: number };
}
export interface JoinResult {
  points: Chain | null;
  warnings: string[];
}
/** Opciones de encadenado (E2-3): capa de eje, tolerancia, inversión de sentido. */
export interface JoinOpts {
  tol?: number;
  layer?: string;
  chainLayers?: string[];
  flip?: boolean;
}

// -------------------------------------------------------------------- PRESETS
export interface TrackPreset {
  id: string;
  name: string;
  build(): Track;
}
export interface VehiclePreset {
  id: string;
  name: string;
  vehicle: Vehicle;
}

// -------------------------------------------------------------------- PROYECTO
/** Configuración cinemática serializable de un proyecto (UI + reglas). */
export interface ProjectUic extends UicParams {
  enabled: boolean;
}

/** Documento de proyecto completo, serializable a JSON (export/import). */
export interface Project {
  /** Versión de BARRIDO que generó el documento (SemVer). */
  version: string;
  vehicle: Vehicle;
  kin: KinRules;
  uic: ProjectUic;
  /** Id de preset de trazado, o null si el eje viene de un DXF importado. */
  trackPreset: string | null;
  /** Eje importado como polilínea (m), si no procede de un preset. */
  trackPoints?: Vec2[];
}

// ------------------------------------------------------------------ JSON SCHEMA
// Esquemas JSON Schema draft-07 exportados (backlog E1-2). Sirven para validar
// documentos de vehículo y de proyecto fuera de la app y para documentar el
// contrato de los ficheros que la UI importa/exporta.

/** JSON Schema del módulo del vehículo. */
export const moduleSchema = {
  type: "object",
  required: ["type", "length", "width"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: { enum: ["bogie", "suspendido"] },
    bogieType: { enum: ["rigido", "pivotante"] },
    length: { type: "number", exclusiveMinimum: 0 },
    width: { type: "number", exclusiveMinimum: 0 },
    pivotFromFront: { type: "number", minimum: 0 },
    wheelbase: { type: "number", exclusiveMinimum: 0 },
    jointFrontOff: { type: "number", minimum: 0 },
    jointRearOff: { type: "number", minimum: 0 },
    cabFront: { type: "boolean" },
    cabRear: { type: "boolean" },
    contour: {
      type: "array",
      minItems: 3,
      items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
    },
  },
} as const;

/** JSON Schema de la rótula/fuelle. */
export const jointSchema = {
  type: "object",
  required: ["type", "gap", "fuelleWidth", "maxAngleDeg", "stiffness"],
  additionalProperties: false,
  properties: {
    type: { enum: ["libre", "rigida", "bisectriz"] },
    gap: { type: "number", minimum: 0 },
    fuelleWidth: { type: "number", minimum: 0 },
    maxAngleDeg: { type: "number", minimum: 0 },
    stiffness: { type: "number", exclusiveMinimum: 0 },
  },
} as const;

/** JSON Schema del vehículo completo (contrato del export "vehiculo.json"). */
export const vehicleSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://barrido/schema/vehicle.json",
  title: "BARRIDO Vehicle",
  type: "object",
  required: ["wheelbase", "modules", "joints"],
  additionalProperties: false,
  properties: {
    wheelbase: { type: "number", exclusiveMinimum: 0 },
    mirror: {
      type: "object",
      required: ["enabled", "protrusion", "length", "offsetFromFront"],
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        protrusion: { type: "number", minimum: 0 },
        length: { type: "number", minimum: 0 },
        offsetFromFront: { type: "number", minimum: 0 },
      },
    },
    modules: { type: "array", minItems: 1, items: moduleSchema },
    joints: { type: "array", items: jointSchema },
  },
} as const;

/** JSON Schema del documento de proyecto completo. */
export const projectSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://barrido/schema/project.json",
  title: "BARRIDO Project",
  type: "object",
  required: ["version", "vehicle", "kin", "uic", "trackPreset"],
  additionalProperties: false,
  properties: {
    version: { type: "string" },
    vehicle: vehicleSchema,
    kin: {
      type: "object",
      required: [
        "enabled",
        "h",
        "e",
        "dMax",
        "rFull",
        "stopped",
        "iMax",
        "sigma",
        "hRoll",
        "q",
        "tAlign",
        "tCant",
      ],
      properties: {
        enabled: { type: "boolean" },
        h: { type: "number" },
        e: { type: "number" },
        dMax: { type: "number" },
        rFull: { type: "number" },
        stopped: { type: "boolean" },
        iMax: { type: "number" },
        sigma: { type: "number" },
        hRoll: { type: "number" },
        q: { type: "number" },
        tAlign: { type: "number" },
        tCant: { type: "number" },
        cantTable: {
          type: "array",
          items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
        },
        speedTable: {
          type: "array",
          items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
        },
      },
    },
    uic: {
      type: "object",
      required: ["enabled", "a", "na", "p", "b"],
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        a: { type: "number" },
        na: { type: "number" },
        p: { type: "number" },
        b: { type: "number" },
      },
    },
    trackPreset: { type: ["string", "null"] },
    trackPoints: {
      type: "array",
      items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
    },
  },
} as const;
