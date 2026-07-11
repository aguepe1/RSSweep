// Internacionalización ES/FR/EN (E3-5). El español es la fuente de verdad: sus
// valores son idénticos al texto que ya vivía en el shell, de modo que la locale
// por defecto (ES) no cambia ni un byte (los tests e2e siguen verdes). `t(key)`
// resuelve por locale con reserva a ES y, en último término, a la propia clave.
// Los textos estáticos del HTML llevan `data-i18n` / `data-i18n-html` /
// `data-i18n-title`; `applyI18n()` los reescribe al cambiar de idioma. El formato
// numérico es solo de presentación (los CSV exportan siempre con punto decimal).

export type Locale = "es" | "fr" | "en";

const LS_KEY = "barrido.lang";

/** Etiqueta BCP-47 para `toLocaleString`/fechas por locale (solo presentación). */
const NUM_LOCALE: Record<Locale, string> = { es: "es-ES", fr: "fr-FR", en: "en-GB" };

/** Diccionarios planos clave→texto. ES = texto original (reserva de las demás). */
const DICT: Record<Locale, Record<string, string>> = {
  es: {
    "menu.file": "Archivo",
    "menu.edit": "Edición",
    "menu.vehicle": "Vehículo",
    "menu.track": "Trazado",
    "menu.calc": "Cálculo",
    "menu.reports": "Informes",
    "menu.help": "Ayuda",
    "file.new": "Nuevo proyecto",
    "file.open": "Abrir proyecto…",
    "file.save": "Guardar proyecto",
    "file.importVeh": "Cargar vehículo (JSON)",
    "file.exportVeh": "Guardar vehículo (JSON)",
    "edit.undo": "Deshacer\u00a0\u00a0Ctrl+Z",
    "edit.redo": "Rehacer\u00a0\u00a0Ctrl+Y",
    "calc.run": "Calcular huella",
    "calc.cancel": "Cancelar cálculo",
    "reports.csv": "Exportar perfil CSV",
    "reports.dxf": "Exportar huella DXF",
    "reports.clash": "Informe de gálibo CSV",
    "help.text":
      "BARRIDO — contra-cálculo de barrido para material rodante tranviario. Unidades internas en metros y radianes. UIC 505-1 / EN 15273 son referencias no certificadas: ver hipótesis del modelo.",
    "rail.input": "▤ Entrada",
    "rail.results": "Resultados ▤",
    "banner.msg": "Se encontró una sesión anterior sin guardar.",
    "banner.recover": "Recuperar",
    "banner.discard": "Descartar",
    "tab.veh": "Vehículo",
    "tab.track": "Trazado",
    "tab.reglas": "Reglas",
    "tab.obs": "Obstáculos",
    "sec.vehicle": "Vehículo",
    "lbl.preset": "Preset",
    "lbl.wheelbase": "Empate de bogie",
    "lbl.mirrors": "Espejos / cámaras",
    "hint.mirrors":
      "Casilla: activar. Campos: protrusión lateral y distancia desde el testero de cabina.",
    "btn.addMod": "+ Añadir módulo",
    "sec.track": "Trazado",
    "lbl.trackPreset": "Preset de prueba",
    "lbl.gauge": "Ancho de vía (mm)",
    "btn.importDxf": "Importar trazado DXF…",
    "btn.importLandxml": "Importar alignment LandXML…",
    "lbl.axisLayer": "Capa del eje",
    "lbl.flip": "Invertir sentido de marcha",
    "lbl.rails": "Importar como dos carriles",
    "hint.track":
      "Soporta LINE, ARC, LWPOLYLINE (con bulge), POLYLINE y SPLINE (muestreo NURBS). Aplica $INSUNITS (convierte a metros y avisa). Con varias capas, elige la del eje; el sentido de marcha es el de dibujo salvo que se invierta.",
    "sec.kin": "Envolvente cinemática",
    "lbl.enable": "Activar",
    "kin.h": "ALTURA CÁLCULO h [m]",
    "kin.e": "ENTRE RODADURAS e [m]",
    "kin.dMax": "PERALTE MÁX D [mm]",
    "kin.rFull": "R PERALTE PLENO [m]",
    "kin.iMax": "INSUFICIENCIA I [mm]",
    "kin.sigma": "SOUPLESSE σ [–]",
    "kin.hRoll": "CENTRO BALANCEO h₀ [m]",
    "kin.q": "JUEGOS LATERALES q [mm]",
    "kin.tAlign": "TOL. ALINEACIÓN [mm]",
    "kin.tCant": "TOL. PERALTE [mm]",
    "lbl.stopped": "Vehículo parado en curva",
    "btn.importCant": "Importar peralte real (CSV pk;D_mm)…",
    "btn.importSpeed": "Importar velocidad (CSV pk;v_kmh)…",
    "hint.kin":
      "Reglas cuasi-estáticas simplificadas: peralte según curvatura local D(s)=D·min(1, R_pleno/R), lean h·D/e hacia el interior, balanceo σ·(E ó I)/e·(h−h₀), más juegos y tolerancias a ambos lados. <b>No es una implementación certificada de EN 15273</b>: sustituir por las reglas de gálibo del proyecto.",
    "sec.uic": "Comparación UIC 505-1",
    "uic.a": "EMPATTEMENT a [m]",
    "uic.na": "VOLADIZO n_a [m]",
    "uic.p": "EMPATE BOGIE p [m]",
    "uic.b": "SEMIANCHO b [m]",
    "btn.uicAuto": "Derivar del vehículo actual",
    "hint.uic":
      "Salientes geométricos clásicos del vehículo equivalente de dos pivotes: interior a²/8R + p²/8R, exterior (a·n+n²)/2R − p²/8R, con R local por PK. Comparado contra la huella <b>geométrica</b> simulada. UIC 505-1 excluye tranvías y asume cuerpo rígido entre pivotes; sus fórmulas son de primer orden (en R&lt;50 m difieren ~1–2 cm del cálculo exacto).",
    "sec.calc": "Cálculo",
    "lbl.simStep": "Paso de simulación",
    "lbl.bothDirs": "Analizar ambos sentidos",
    "hint.both":
      "Resuelve el barrido de ida y de vuelta y une las envolventes. Necesario en vehículos asimétricos o trazados con contracurvas, donde cada sentido genera una huella distinta.",
    "sec.obs": "Obstáculos · clash check",
    "btn.importObs": "Importar obstáculos DXF…",
    "lbl.reqMargin": "Margen requerido",
    "btn.obsClear": "Quitar obstáculos",
    "hint.obs":
      "Bordes de andén, postes, fachadas… como polilíneas/líneas en el mismo sistema de coordenadas que el trazado. El margen se mide contra la envolvente cinemática si está activa; si no, contra la geométrica.",
    "sec.hyp": "Hipótesis del modelo",
    "hint.hyp":
      "Pivotes de bogie sobre el eje de vía · caja de módulo bogie alineada con la secante local (empate) · módulos suspendidos como cuerda rígida entre articulaciones · sin balanceo, peralte, juegos ni tolerancias (Fase 3).",
    "lay.footprint": "huella",
    "lay.kin": "cinemática",
    "lay.uic": "UIC",
    "lay.obs": "obstáculos",
    "lay.veh": "vehículo",
    "lay.rail": "carriles",
    "tool.grid": "rejilla",
    "tool.dark": "fondo oscuro",
    "btn.measure": "Medir (M)",
    "leg.footprint": "huella barrida",
    "leg.axis": "eje de vía",
    "leg.rail": "carriles",
    "leg.vehicle": "vehículo",
    "leg.fuelle": "fuelle",
    "leg.kin": "envolv. cinemática",
    "leg.obstacles": "obstáculos",
    "leg.invasion": "invasión de gálibo",
    "btn.play": "▶ Reproducir",
    "btn.pause": "❚❚ Pausa",
    "btn.fit": "Encuadrar",
    "scrub.label": "Posición de reproducción (PK)",
    "profile.title": "Semianchos barridos respecto al eje · por PK",
    "panel.results": "Resultados",
    "cart.title": "CAJETÍN DE RESULTADOS",
    "btn.dxfOut": "Exportar huella DXF",
    "btn.csvOut": "Exportar perfil CSV",
    "btn.clashOut": "Informe gálibo CSV",
    "joints.title": "Rótulas y fuelles",
    "hint.joints":
      "Tipo <b>libre</b>: pivote sin control de lazo (cuerda entre articulaciones). Tipo <b>rígida</b>: bloquea el giro (los módulos se mueven solidarios); no admisible aguas arriba de un bogie. El hueco de testeros lo cubre el fuelle, incluido en la huella.",
    "sb.file": "Fichero",
    "sb.units": "metros · radianes",
    // — cajetín (etiquetas dinámicas) —
    "cart.noCalc": "Sin cálculo",
    "cart.vehicle": "Vehículo",
    "cart.track": "Trazado",
    "cart.modules": "módulos",
    "cart.maxLeft": "Semiancho máx. izq.",
    "cart.maxRight": "Semiancho máx. dcha.",
    "cart.totalWidth": "Ancho total barrido",
    "cart.overWidth": "Sobreancho vs. caja",
    "cart.dir": "Sentido de análisis",
    "cart.kinLR": "Envolv. cinemática izq/dcha",
    "cart.kinTotal": "Envolv. cinemática total",
    "cart.uicEquiv": "UIC 505-1 equiv. int/ext",
    "cart.uicDelta": "Δ UIC − simulado (geo)",
    "cart.clashMargin": "Margen mín. a obstáculo",
    "cart.violations": "Invasiones de margen",
    "cart.steps": "Pasos / tiempo",
    "cart.stepsUnit": "pasos",
    // — hipótesis (barra de estado) —
    "hyp.geo": "geométrica",
    "hyp.kin": "cinemática",
    "hyp.uic": "UIC 505",
    "hyp.bidir": "bidireccional",
  },
  fr: {
    "menu.file": "Fichier",
    "menu.edit": "Édition",
    "menu.vehicle": "Véhicule",
    "menu.track": "Tracé",
    "menu.calc": "Calcul",
    "menu.reports": "Rapports",
    "menu.help": "Aide",
    "file.new": "Nouveau projet",
    "file.open": "Ouvrir un projet…",
    "file.save": "Enregistrer le projet",
    "file.importVeh": "Charger véhicule (JSON)",
    "file.exportVeh": "Enregistrer véhicule (JSON)",
    "edit.undo": "Annuler\u00a0\u00a0Ctrl+Z",
    "edit.redo": "Rétablir\u00a0\u00a0Ctrl+Y",
    "calc.run": "Calculer le balayage",
    "calc.cancel": "Annuler le calcul",
    "reports.csv": "Exporter profil CSV",
    "reports.dxf": "Exporter balayage DXF",
    "reports.clash": "Rapport de gabarit CSV",
    "help.text":
      "BARRIDO — contre-calcul de balayage pour matériel roulant tramway. Unités internes en mètres et radians. UIC 505-1 / EN 15273 sont des références non certifiées : voir les hypothèses du modèle.",
    "rail.input": "▤ Entrée",
    "rail.results": "Résultats ▤",
    "banner.msg": "Une session précédente non enregistrée a été trouvée.",
    "banner.recover": "Récupérer",
    "banner.discard": "Ignorer",
    "tab.veh": "Véhicule",
    "tab.track": "Tracé",
    "tab.reglas": "Règles",
    "tab.obs": "Obstacles",
    "sec.vehicle": "Véhicule",
    "lbl.preset": "Préréglage",
    "lbl.wheelbase": "Empattement de bogie",
    "lbl.mirrors": "Rétroviseurs / caméras",
    "hint.mirrors":
      "Case : activer. Champs : saillie latérale et distance depuis la face avant de cabine.",
    "btn.addMod": "+ Ajouter un module",
    "sec.track": "Tracé",
    "lbl.trackPreset": "Tracé d’essai",
    "lbl.gauge": "Écartement (mm)",
    "btn.importDxf": "Importer tracé DXF…",
    "btn.importLandxml": "Importer alignement LandXML…",
    "lbl.axisLayer": "Calque de l’axe",
    "lbl.flip": "Inverser le sens de marche",
    "lbl.rails": "Importer comme deux rails",
    "hint.track":
      "Prend en charge LINE, ARC, LWPOLYLINE (avec bulge), POLYLINE et SPLINE (échantillonnage NURBS). Applique $INSUNITS (convertit en mètres et avertit). Avec plusieurs calques, choisir celui de l’axe ; le sens de marche est celui du dessin sauf inversion.",
    "sec.kin": "Enveloppe cinématique",
    "lbl.enable": "Activer",
    "kin.h": "HAUTEUR CALCUL h [m]",
    "kin.e": "ENTRE ROULEMENTS e [m]",
    "kin.dMax": "DÉVERS MAX D [mm]",
    "kin.rFull": "R DÉVERS PLEIN [m]",
    "kin.iMax": "INSUFFISANCE I [mm]",
    "kin.sigma": "SOUPLESSE σ [–]",
    "kin.hRoll": "CENTRE ROULIS h₀ [m]",
    "kin.q": "JEUX LATÉRAUX q [mm]",
    "kin.tAlign": "TOL. ALIGNEMENT [mm]",
    "kin.tCant": "TOL. DÉVERS [mm]",
    "lbl.stopped": "Véhicule à l’arrêt en courbe",
    "btn.importCant": "Importer dévers réel (CSV pk;D_mm)…",
    "btn.importSpeed": "Importer vitesse (CSV pk;v_kmh)…",
    "hint.kin":
      "Règles quasi-statiques simplifiées : dévers selon la courbure locale D(s)=D·min(1, R_plein/R), inclinaison h·D/e vers l’intérieur, roulis σ·(E ou I)/e·(h−h₀), plus jeux et tolérances des deux côtés. <b>Ce n’est pas une implémentation certifiée d’EN 15273</b> : remplacer par les règles de gabarit du projet.",
    "sec.uic": "Comparaison UIC 505-1",
    "uic.a": "EMPATTEMENT a [m]",
    "uic.na": "PORTE-À-FAUX n_a [m]",
    "uic.p": "EMPATTEMENT BOGIE p [m]",
    "uic.b": "DEMI-LARGEUR b [m]",
    "btn.uicAuto": "Dériver du véhicule actuel",
    "hint.uic":
      "Saillies géométriques classiques du véhicule équivalent à deux pivots : intérieur a²/8R + p²/8R, extérieur (a·n+n²)/2R − p²/8R, avec R local par PK. Comparé à l’empreinte <b>géométrique</b> simulée. UIC 505-1 exclut les tramways et suppose un corps rigide entre pivots ; ses formules sont du premier ordre (à R&lt;50 m elles diffèrent d’~1–2 cm du calcul exact).",
    "sec.calc": "Calcul",
    "lbl.simStep": "Pas de simulation",
    "lbl.bothDirs": "Analyser les deux sens",
    "hint.both":
      "Résout le balayage aller et retour et fusionne les enveloppes. Nécessaire pour les véhicules asymétriques ou les tracés à contre-courbes, où chaque sens génère une empreinte différente.",
    "sec.obs": "Obstacles · clash check",
    "btn.importObs": "Importer obstacles DXF…",
    "lbl.reqMargin": "Marge requise",
    "btn.obsClear": "Retirer les obstacles",
    "hint.obs":
      "Bords de quai, poteaux, façades… comme polylignes/lignes dans le même système de coordonnées que le tracé. La marge est mesurée contre l’enveloppe cinématique si active ; sinon contre la géométrique.",
    "sec.hyp": "Hypothèses du modèle",
    "hint.hyp":
      "Pivots de bogie sur l’axe de voie · caisse de module bogie alignée sur la sécante locale (empattement) · modules suspendus comme corde rigide entre articulations · sans roulis, dévers, jeux ni tolérances (Phase 3).",
    "lay.footprint": "empreinte",
    "lay.kin": "cinématique",
    "lay.uic": "UIC",
    "lay.obs": "obstacles",
    "lay.veh": "véhicule",
    "lay.rail": "rails",
    "tool.grid": "grille",
    "tool.dark": "fond sombre",
    "btn.measure": "Mesurer (M)",
    "leg.footprint": "empreinte balayée",
    "leg.axis": "axe de voie",
    "leg.rail": "rails",
    "leg.vehicle": "véhicule",
    "leg.fuelle": "soufflet",
    "leg.kin": "env. cinématique",
    "leg.obstacles": "obstacles",
    "leg.invasion": "intrusion de gabarit",
    "btn.play": "▶ Lecture",
    "btn.pause": "❚❚ Pause",
    "btn.fit": "Cadrer",
    "scrub.label": "Position de lecture (PK)",
    "profile.title": "Demi-largeurs balayées par rapport à l’axe · par PK",
    "panel.results": "Résultats",
    "cart.title": "CARTOUCHE DE RÉSULTATS",
    "btn.dxfOut": "Exporter balayage DXF",
    "btn.csvOut": "Exporter profil CSV",
    "btn.clashOut": "Rapport gabarit CSV",
    "joints.title": "Articulations et soufflets",
    "hint.joints":
      "Type <b>libre</b> : pivot sans contrôle de lacet (corde entre articulations). Type <b>rigide</b> : bloque la rotation (les modules se déplacent solidairement) ; non admissible en amont d’un bogie. L’espace entre faces est couvert par le soufflet, inclus dans l’empreinte.",
    "sb.file": "Fichier",
    "sb.units": "mètres · radians",
    "cart.noCalc": "Aucun calcul",
    "cart.vehicle": "Véhicule",
    "cart.track": "Tracé",
    "cart.modules": "modules",
    "cart.maxLeft": "Demi-largeur max. gauche",
    "cart.maxRight": "Demi-largeur max. droite",
    "cart.totalWidth": "Largeur totale balayée",
    "cart.overWidth": "Surlargeur vs caisse",
    "cart.dir": "Sens d’analyse",
    "cart.kinLR": "Env. cinématique g/d",
    "cart.kinTotal": "Env. cinématique totale",
    "cart.uicEquiv": "UIC 505-1 équiv. int/ext",
    "cart.uicDelta": "Δ UIC − simulé (géo)",
    "cart.clashMargin": "Marge min. à l’obstacle",
    "cart.violations": "Intrusions de marge",
    "cart.steps": "Pas / temps",
    "cart.stepsUnit": "pas",
    "hyp.geo": "géométrique",
    "hyp.kin": "cinématique",
    "hyp.uic": "UIC 505",
    "hyp.bidir": "bidirectionnel",
  },
  en: {
    "menu.file": "File",
    "menu.edit": "Edit",
    "menu.vehicle": "Vehicle",
    "menu.track": "Track",
    "menu.calc": "Compute",
    "menu.reports": "Reports",
    "menu.help": "Help",
    "file.new": "New project",
    "file.open": "Open project…",
    "file.save": "Save project",
    "file.importVeh": "Load vehicle (JSON)",
    "file.exportVeh": "Save vehicle (JSON)",
    "edit.undo": "Undo\u00a0\u00a0Ctrl+Z",
    "edit.redo": "Redo\u00a0\u00a0Ctrl+Y",
    "calc.run": "Compute swept path",
    "calc.cancel": "Cancel computation",
    "reports.csv": "Export profile CSV",
    "reports.dxf": "Export swept path DXF",
    "reports.clash": "Clearance report CSV",
    "help.text":
      "BARRIDO — swept-path counter-calculation for tram rolling stock. Internal units in metres and radians. UIC 505-1 / EN 15273 are non-certified references: see model assumptions.",
    "rail.input": "▤ Input",
    "rail.results": "Results ▤",
    "banner.msg": "An unsaved previous session was found.",
    "banner.recover": "Recover",
    "banner.discard": "Discard",
    "tab.veh": "Vehicle",
    "tab.track": "Track",
    "tab.reglas": "Rules",
    "tab.obs": "Obstacles",
    "sec.vehicle": "Vehicle",
    "lbl.preset": "Preset",
    "lbl.wheelbase": "Bogie wheelbase",
    "lbl.mirrors": "Mirrors / cameras",
    "hint.mirrors": "Checkbox: enable. Fields: lateral protrusion and distance from the cab end.",
    "btn.addMod": "+ Add module",
    "sec.track": "Track",
    "lbl.trackPreset": "Test track",
    "lbl.gauge": "Track gauge (mm)",
    "btn.importDxf": "Import track DXF…",
    "btn.importLandxml": "Import LandXML alignment…",
    "lbl.axisLayer": "Axis layer",
    "lbl.flip": "Reverse travel direction",
    "lbl.rails": "Import as two rails",
    "hint.track":
      "Supports LINE, ARC, LWPOLYLINE (with bulge), POLYLINE and SPLINE (NURBS sampling). Applies $INSUNITS (converts to metres and warns). With several layers, pick the axis one; travel direction is the drawing direction unless reversed.",
    "sec.kin": "Kinematic envelope",
    "lbl.enable": "Enable",
    "kin.h": "CALC HEIGHT h [m]",
    "kin.e": "BETWEEN RAILS e [m]",
    "kin.dMax": "MAX CANT D [mm]",
    "kin.rFull": "FULL-CANT R [m]",
    "kin.iMax": "CANT DEFICIENCY I [mm]",
    "kin.sigma": "FLEXIBILITY σ [–]",
    "kin.hRoll": "ROLL CENTRE h₀ [m]",
    "kin.q": "LATERAL PLAY q [mm]",
    "kin.tAlign": "ALIGNMENT TOL. [mm]",
    "kin.tCant": "CANT TOL. [mm]",
    "lbl.stopped": "Vehicle stopped in curve",
    "btn.importCant": "Import real cant (CSV pk;D_mm)…",
    "btn.importSpeed": "Import speed (CSV pk;v_kmh)…",
    "hint.kin":
      "Simplified quasi-static rules: cant per local curvature D(s)=D·min(1, R_full/R), lean h·D/e toward the inside, roll σ·(E or I)/e·(h−h₀), plus play and tolerances on both sides. <b>This is not a certified EN 15273 implementation</b>: replace with the project’s clearance rules.",
    "sec.uic": "UIC 505-1 comparison",
    "uic.a": "WHEELBASE a [m]",
    "uic.na": "OVERHANG n_a [m]",
    "uic.p": "BOGIE WHEELBASE p [m]",
    "uic.b": "HALF-WIDTH b [m]",
    "btn.uicAuto": "Derive from current vehicle",
    "hint.uic":
      "Classic geometric overthrows of the equivalent two-pivot vehicle: inner a²/8R + p²/8R, outer (a·n+n²)/2R − p²/8R, with local R per PK. Compared against the simulated <b>geometric</b> footprint. UIC 505-1 excludes trams and assumes a rigid body between pivots; its formulas are first-order (at R&lt;50 m they differ ~1–2 cm from the exact calculation).",
    "sec.calc": "Computation",
    "lbl.simStep": "Simulation step",
    "lbl.bothDirs": "Analyse both directions",
    "hint.both":
      "Solves the forward and return sweep and merges the envelopes. Needed for asymmetric vehicles or tracks with reverse curves, where each direction yields a different footprint.",
    "sec.obs": "Obstacles · clash check",
    "btn.importObs": "Import obstacles DXF…",
    "lbl.reqMargin": "Required margin",
    "btn.obsClear": "Remove obstacles",
    "hint.obs":
      "Platform edges, poles, façades… as polylines/lines in the same coordinate system as the track. The margin is measured against the kinematic envelope if active; otherwise against the geometric one.",
    "sec.hyp": "Model assumptions",
    "hint.hyp":
      "Bogie pivots on the track axis · bogie-module body aligned with the local secant (wheelbase) · suspended modules as a rigid chord between articulations · no roll, cant, play or tolerances (Phase 3).",
    "lay.footprint": "footprint",
    "lay.kin": "kinematic",
    "lay.uic": "UIC",
    "lay.obs": "obstacles",
    "lay.veh": "vehicle",
    "lay.rail": "rails",
    "tool.grid": "grid",
    "tool.dark": "dark background",
    "btn.measure": "Measure (M)",
    "leg.footprint": "swept footprint",
    "leg.axis": "track axis",
    "leg.rail": "rails",
    "leg.vehicle": "vehicle",
    "leg.fuelle": "bellows",
    "leg.kin": "kinematic env.",
    "leg.obstacles": "obstacles",
    "leg.invasion": "clearance intrusion",
    "btn.play": "▶ Play",
    "btn.pause": "❚❚ Pause",
    "btn.fit": "Fit",
    "scrub.label": "Playback position (PK)",
    "profile.title": "Swept half-widths about the axis · per PK",
    "panel.results": "Results",
    "cart.title": "RESULTS CARTOUCHE",
    "btn.dxfOut": "Export swept path DXF",
    "btn.csvOut": "Export profile CSV",
    "btn.clashOut": "Clearance report CSV",
    "joints.title": "Articulations and bellows",
    "hint.joints":
      "Type <b>free</b>: pivot with no yaw control (chord between articulations). Type <b>rigid</b>: locks rotation (modules move together); not admissible upstream of a bogie. The end-face gap is covered by the bellows, included in the footprint.",
    "sb.file": "File",
    "sb.units": "metres · radians",
    "cart.noCalc": "No computation",
    "cart.vehicle": "Vehicle",
    "cart.track": "Track",
    "cart.modules": "modules",
    "cart.maxLeft": "Max half-width left",
    "cart.maxRight": "Max half-width right",
    "cart.totalWidth": "Total swept width",
    "cart.overWidth": "Over-width vs body",
    "cart.dir": "Analysis direction",
    "cart.kinLR": "Kinematic env. l/r",
    "cart.kinTotal": "Kinematic env. total",
    "cart.uicEquiv": "UIC 505-1 equiv. in/out",
    "cart.uicDelta": "Δ UIC − simulated (geo)",
    "cart.clashMargin": "Min margin to obstacle",
    "cart.violations": "Margin intrusions",
    "cart.steps": "Steps / time",
    "cart.stepsUnit": "steps",
    "hyp.geo": "geometric",
    "hyp.kin": "kinematic",
    "hyp.uic": "UIC 505",
    "hyp.bidir": "bidirectional",
  },
};

let LOCALE: Locale = "es";

/** Locale activa. */
export function locale(): Locale {
  return LOCALE;
}

/** Etiqueta BCP-47 de la locale activa (para formato numérico/fecha de presentación). */
export function numLocale(): string {
  return NUM_LOCALE[LOCALE];
}

/** Traduce `key` a la locale activa (reserva a ES y luego a la propia clave). */
export function t(key: string): string {
  return DICT[LOCALE][key] ?? DICT.es[key] ?? key;
}

/** Reescribe todos los textos estáticos marcados con `data-i18n*` a la locale activa. */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel!));
  });
  document.documentElement.lang = LOCALE;
}

/** Fija la locale (persistiendo la elección) sin re-renderizar (lo hace el llamador). */
export function setLocale(loc: Locale): void {
  LOCALE = loc;
  try {
    localStorage.setItem(LS_KEY, loc);
  } catch {
    /* almacenamiento no disponible: la preferencia de idioma es best-effort */
  }
}

/** Lee la locale guardada (o `null` si no hay o el almacenamiento falla). */
export function savedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === "es" || v === "fr" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Cablea el selector de idioma: aplica la locale guardada al arrancar y, en cada
 * cambio, fija la locale, reescribe los textos estáticos y pide al llamador que
 * re-renderice las partes dinámicas (cajetín, paneles, barra de estado…).
 */
export function initI18n(onChange: () => void): void {
  const saved = savedLocale();
  if (saved) LOCALE = saved;
  const sel = document.getElementById("langSel") as HTMLSelectElement | null;
  if (sel) {
    sel.value = LOCALE;
    sel.addEventListener("change", () => {
      setLocale(sel.value as Locale);
      applyI18n();
      onChange();
    });
  }
  applyI18n();
}
