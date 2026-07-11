// Única fuente de color para los lienzos (viewport y perfil). El color es
// EXCLUSIVAMENTE semántica de datos (DESIGN_SPEC §3): huella, envolvente
// cinemática, UIC, vehículo, fuelle, obstáculos, invasión. Los neutros (rejilla,
// ejes, texto tenue) y el fondo del viewport tienen variante clara/oscura; el
// viewport puede conmutarse a fondo oscuro sin cambiar la semántica de datos.

/** Colores de dato (constantes; no dependen del tema claro/oscuro). */
export const C = {
  // huella geométrica barrida
  footprint: "#C62828",
  footprintFill: "rgba(198,40,40,.15)",
  // envolvente cinemática (reglas cuasi-estáticas)
  kin: "#B8860B",
  kinFill: "rgba(184,134,11,.14)",
  // comparación UIC 505-1
  uic: "#2E7D32",
  // vehículo (caja) y espejos
  vehicle: "#1565C0",
  vehicleFill: "rgba(21,101,192,.16)",
  vehicleFillStrong: "rgba(21,101,192,.26)",
  // fuelle entre módulos
  fuelle: "#78838F",
  fuelleFill: "rgba(120,131,143,.28)",
  // carriles de la vía (infraestructura; gris acero) y bastidor/ejes del bogie
  rail: "#546E7A",
  bogie: "#37474F",
  // obstáculos e invasión de gálibo
  obstacle: "#1A1D21",
  invasion: "#C62828",
  // margen de obstáculo dentro de tolerancia
  ok: "#2E7D32",
  // neutros de tinta (para el perfil, siempre sobre papel claro)
  ink: "#1A1D21",
  secondary: "#5A6470",
  hairline: "#D9DDE2",
  axis: "#C0C6CD",
} as const;

/** Neutros del lienzo del viewport, con variante clara y oscura (toggle). */
export interface ViewportTheme {
  bg: string;
  grid: string;
  axis: string;
  faint: string;
  labelBg: string;
  labelInk: string;
}

export const VIEWPORT_LIGHT: ViewportTheme = {
  bg: "#FFFFFF",
  grid: "#ECEEF1",
  axis: "#C0C6CD",
  faint: "#5A6470",
  labelBg: "rgba(255,255,255,.90)",
  labelInk: "#1A1D21",
};

export const VIEWPORT_DARK: ViewportTheme = {
  bg: "#14171C",
  grid: "#232830",
  axis: "#3A424C",
  faint: "#8B98A6",
  labelBg: "rgba(20,23,28,.85)",
  labelInk: "#E7ECF2",
};

let current: ViewportTheme = VIEWPORT_LIGHT;

/** Tema actual del lienzo del viewport (por defecto claro). */
export function viewportTheme(): ViewportTheme {
  return current;
}

/** Conmuta el fondo del viewport a oscuro/claro (no afecta a la semántica). */
export function setViewportDark(dark: boolean): void {
  current = dark ? VIEWPORT_DARK : VIEWPORT_LIGHT;
}
