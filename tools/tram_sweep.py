#!/usr/bin/env python3
"""
tram_sweep.py — Motor de sweep analysis (huella geometrica) para tranvias.

FASE 1: modelo cinematico puro (sin envolvente dinamica).

Modelo:
  - Trazado parametrizado por longitud de arco s, curvatura k(s) definida a tramos
    (recta / clotoide / curva circular). Integracion numerica de rumbo y posicion.
  - Vehiculo multi-cuerpo:
      * Modulos "bogie": el pivote de bogie sigue el eje de via. La orientacion
        de la caja se toma como la SECANTE local del eje sobre el empate del bogie
        (hipotesis: amortiguadores anti-lazo centran la caja sobre el bogie).
      * Modulos "suspendidos": cuerda rigida entre las articulaciones de los
        modulos adyacentes. Su posicion cierra la cadena: la posicion del pivote
        siguiente se resuelve con |A_i - A_j(s)| = L_susp  (root finding 1D).
  - Huella = union booleana (Shapely) de los contornos de todos los modulos en
    todos los pasos de la simulacion. Espejos modelados como protrusiones en cabinas.

Salidas: DXF (eje, huella, snapshots), PNG (planta + diagrama de sobreancho), resumen txt.

Hipotesis declaradas (limitaciones Fase 1):
  1. Sin balanceo, peralte, juegos de suspension, desgaste ni tolerancias de via
     (eso es la envolvente cinematica, Fase 3).
  2. Caja de modulo bogie alineada con secante de via (sin yaw caja-bogie).
  3. Cajas rectangulares (sin afinamiento de testeros; conservador en curva interior).
"""

import json
import numpy as np
from scipy.optimize import brentq
from shapely.geometry import Polygon, LineString, MultiLineString
from shapely.ops import unary_union
import ezdxf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ----------------------------------------------------------------------------
# 1. TRAZADO
# ----------------------------------------------------------------------------

class Track:
    """Eje de via por integracion de curvatura k(s). Convenio: k>0 gira a izquierda."""

    def __init__(self, segments, ds=0.01):
        """segments: lista de (tipo, longitud, params)
             ('straight', L)
             ('clothoid', L, k_ini, k_fin)   curvatura lineal en s
             ('arc', L, k)                    curvatura constante
        """
        s_list, k_list = [0.0], [self._k_at_start(segments[0])]
        s0 = 0.0
        pieces = []
        for seg in segments:
            typ, L = seg[0], seg[1]
            if typ == "straight":
                pieces.append((s0, s0 + L, 0.0, 0.0))
            elif typ == "arc":
                pieces.append((s0, s0 + L, seg[2], seg[2]))
            elif typ == "clothoid":
                pieces.append((s0, s0 + L, seg[2], seg[3]))
            s0 += L
        self.length = s0
        self.s = np.arange(0.0, self.length + ds, ds)
        k = np.zeros_like(self.s)
        for (sa, sb, ka, kb) in pieces:
            m = (self.s >= sa) & (self.s <= sb)
            if sb > sa:
                k[m] = ka + (kb - ka) * (self.s[m] - sa) / (sb - sa)
        self.k = k
        # rumbo y posicion por integracion trapezoidal
        self.theta = np.concatenate([[0.0], np.cumsum(0.5 * (k[1:] + k[:-1]) * np.diff(self.s))])
        cx = np.cos(self.theta); sy = np.sin(self.theta)
        self.x = np.concatenate([[0.0], np.cumsum(0.5 * (cx[1:] + cx[:-1]) * np.diff(self.s))])
        self.y = np.concatenate([[0.0], np.cumsum(0.5 * (sy[1:] + sy[:-1]) * np.diff(self.s))])

    @staticmethod
    def _k_at_start(seg):
        return 0.0 if seg[0] == "straight" else (seg[2] if seg[0] in ("arc", "clothoid") else 0.0)

    def pos(self, s):
        s = np.clip(s, 0.0, self.length)
        return np.array([np.interp(s, self.s, self.x), np.interp(s, self.s, self.y)])

    def heading(self, s):
        s = np.clip(s, 0.0, self.length)
        return np.interp(s, self.s, self.theta)

    def secant_heading(self, s, base):
        """Rumbo de la secante del eje sobre una base (empate de bogie) centrada en s."""
        p1 = self.pos(s - base / 2.0)
        p2 = self.pos(s + base / 2.0)
        d = p2 - p1
        return np.arctan2(d[1], d[0])

    def centerline(self, step=0.25):
        ss = np.arange(0.0, self.length + step, step)
        return np.column_stack([np.interp(ss, self.s, self.x), np.interp(ss, self.s, self.y)])


# ----------------------------------------------------------------------------
# 2. VEHICULO Y CADENA CINEMATICA
# ----------------------------------------------------------------------------

def unit(theta):
    return np.array([np.cos(theta), np.sin(theta)])

class Tram:
    def __init__(self, spec):
        self.spec = spec
        self.modules = spec["modules"]
        self.wheelbase = spec.get("bogie_wheelbase", 1.8)
        self.mirror = spec.get("mirror", None)

    def solve_chain(self, track, s1):
        """Resuelve la pose de los 5 modulos con el pivote delantero (C1) en arco s1.
        Devuelve lista de dicts {id, origin(front-center), theta, length, width, extras}."""
        m = self.modules
        C1, S2, C3, S4, C5 = m
        wb = self.wheelbase

        poses = {}

        # --- C1: pivote en via, rumbo = secante local
        th1 = track.secant_heading(s1, wb)
        P1 = track.pos(s1)
        front1 = P1 + C1["pivot_from_front"] * unit(th1)
        A1 = front1 - C1["joint_rear_from_front"] * unit(th1)  # articulacion trasera C1
        poses["C1"] = dict(front=front1, theta=th1)

        # --- C3: resolver s2 tal que |A1 - joint_front_C3(s2)| = L_S2
        L2 = S2["length"]

        def g2(s2):
            th3 = track.secant_heading(s2, wb)
            P2 = track.pos(s2)
            front3 = P2 + C3["pivot_from_front"] * unit(th3)
            A2 = front3 - C3["joint_front_from_front"] * unit(th3)
            return np.hypot(*(A1 - A2)) - L2

        guess = s1 - (C1["joint_rear_from_front"] - C1["pivot_from_front"]) - L2 - C3["pivot_from_front"]
        s2 = brentq(g2, guess - 1.5, guess + 1.5, xtol=1e-6)
        th3 = track.secant_heading(s2, wb)
        P2 = track.pos(s2)
        front3 = P2 + C3["pivot_from_front"] * unit(th3)
        A2 = front3 - C3["joint_front_from_front"] * unit(th3)
        A3 = front3 - C3["joint_rear_from_front"] * unit(th3)
        poses["C3"] = dict(front=front3, theta=th3)

        # --- S2: cuerda entre articulaciones; frente en A1, rumbo en sentido de marcha
        d = A1 - A2
        poses["S2"] = dict(front=A1, theta=np.arctan2(d[1], d[0]))

        # --- C5: resolver s3 con |A3 - joint_front_C5(s3)| = L_S4
        L4 = S4["length"]

        def g3(s3):
            th5 = track.secant_heading(s3, wb)
            P3 = track.pos(s3)
            front5 = P3 + C5["pivot_from_front"] * unit(th5)
            A4 = front5 - C5["joint_front_from_front"] * unit(th5)
            return np.hypot(*(A3 - A4)) - L4

        guess = s2 - (C3["joint_rear_from_front"] - C3["pivot_from_front"]) - L4 - C5["pivot_from_front"]
        s3 = brentq(g3, guess - 1.5, guess + 1.5, xtol=1e-6)
        th5 = track.secant_heading(s3, wb)
        P3 = track.pos(s3)
        front5 = P3 + C5["pivot_from_front"] * unit(th5)
        A4 = front5 - C5["joint_front_from_front"] * unit(th5)
        poses["C5"] = dict(front=front5, theta=th5)

        # --- S4: cuerda entre articulaciones; frente en A3, rumbo en sentido de marcha
        d = A3 - A4
        poses["S4"] = dict(front=A3, theta=np.arctan2(d[1], d[0]))

        return poses, (s1, s2, s3)

    def footprint(self, poses):
        """Poligonos Shapely de cada modulo (+ espejos en cabinas) para una pose dada."""
        polys = []
        for mod in self.modules:
            p = poses[mod["id"]]
            L, W = mod["length"], mod["width"]
            th, F = p["theta"], p["front"]
            u, n = unit(th), unit(th + np.pi / 2.0)
            hw = W / 2.0
            corners = [F + hw * n, F - hw * n, F - L * u - hw * n, F - L * u + hw * n]
            polys.append(Polygon(corners))
            # espejos / camaras exteriores en cabinas
            if self.mirror and (mod.get("cab_front") or mod.get("cab_rear")):
                mp, ml = self.mirror["protrusion"], self.mirror["length"]
                off = self.mirror["offset_from_front"]
                if mod.get("cab_front"):
                    c = F - off * u
                else:  # cabina trasera: espejo cerca del testero trasero
                    c = F - (L - off) * u
                for side in (+1, -1):
                    base = c + side * hw * n
                    polys.append(Polygon([base, base + side * mp * n,
                                          base + side * mp * n - ml * u, base - ml * u]))
        return polys


# ----------------------------------------------------------------------------
# 3. BARRIDO Y ANALISIS
# ----------------------------------------------------------------------------

def run_sweep(track, tram, s_start, s_end, step=0.25):
    all_polys, snapshots, chain_s = [], [], []
    for s1 in np.arange(s_start, s_end + step, step):
        poses, ss = tram.solve_chain(track, s1)
        polys = tram.footprint(poses)
        all_polys.extend(polys)
        chain_s.append(ss)
        snapshots.append((s1, polys))
    envelope = unary_union(all_polys)
    if envelope.geom_type == "MultiPolygon":
        envelope = max(envelope.geoms, key=lambda g: g.area)
    return envelope, snapshots, chain_s


def clearance_profile(track, envelope, step=0.5, reach=4.0):
    """Semianchos barridos (izq/dcha) respecto al eje de via, por PK."""
    rows = []
    for s in np.arange(0.0, track.length + step, step):
        p = track.pos(s)
        th = track.heading(s)
        n = unit(th + np.pi / 2.0)
        probe = LineString([p - reach * n, p + reach * n])
        inter = probe.intersection(envelope)
        if inter.is_empty:
            continue
        segs = list(inter.geoms) if isinstance(inter, MultiLineString) else [inter]
        offs = []
        for seg in segs:
            for c in seg.coords:
                offs.append(np.dot(np.array(c) - p, n))
        rows.append((s, min(offs), max(offs)))
    return np.array(rows)


# ----------------------------------------------------------------------------
# 4. SALIDAS
# ----------------------------------------------------------------------------

def export_dxf(path, track, envelope, snapshots, snapshot_every=40):
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    for name, color in [("EJE_VIA", 3), ("HUELLA", 1), ("VEHICULO", 5)]:
        doc.layers.add(name, color=color)
    msp.add_lwpolyline(track.centerline(0.25), dxfattribs={"layer": "EJE_VIA"})
    def add_poly(poly, layer):
        msp.add_lwpolyline(list(poly.exterior.coords), close=True, dxfattribs={"layer": layer})
        for ring in poly.interiors:
            msp.add_lwpolyline(list(ring.coords), close=True, dxfattribs={"layer": layer})
    geoms = envelope.geoms if envelope.geom_type == "MultiPolygon" else [envelope]
    for g in geoms:
        add_poly(g, "HUELLA")
    for i, (s1, polys) in enumerate(snapshots):
        if i % snapshot_every == 0:
            for poly in polys:
                add_poly(poly, "VEHICULO")
    doc.saveas(path)


def export_png(path, track, envelope, snapshots, profile, body_width, R):
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 14),
                                   gridspec_kw={"height_ratios": [2.2, 1]})
    # Planta
    cl = track.centerline(0.25)
    xs, ys = envelope.exterior.xy
    ax1.fill(xs, ys, color="#f4a3a3", alpha=0.55, zorder=1, label="Huella barrida")
    ax1.plot(xs, ys, color="#c0392b", lw=1.0, zorder=2)
    for ring in envelope.interiors:
        rx, ry = ring.xy
        ax1.fill(rx, ry, color="white", zorder=2)
        ax1.plot(rx, ry, color="#c0392b", lw=1.0, zorder=3)
    ax1.plot(cl[:, 0], cl[:, 1], "k--", lw=1.2, zorder=4, label="Eje de via")
    for i, (s1, polys) in enumerate(snapshots):
        if i % 40 == 0:
            for poly in polys:
                px, py = poly.exterior.xy
                ax1.plot(px, py, color="#2c3e50", lw=0.7, zorder=5)
    ax1.set_aspect("equal")
    ax1.set_title(f"Sweep analysis — tranvia 5 modulos sobre curva R{R} m con clotoides")
    ax1.set_xlabel("x [m]"); ax1.set_ylabel("y [m]")
    ax1.legend(loc="lower right"); ax1.grid(alpha=0.3)
    # Diagrama de sobreancho
    s, left, right = profile[:, 0], profile[:, 2], profile[:, 1]
    ax2.plot(s, left, color="#c0392b", lw=1.5, label="Semiancho lado interior (izq)")
    ax2.plot(s, -right, color="#2980b9", lw=1.5, label="Semiancho lado exterior (dcha)")
    ax2.axhline(body_width / 2.0, color="gray", ls=":", lw=1.2,
                label=f"Semiancho de caja ({body_width/2.0:.3f} m)")
    ax2.set_xlabel("PK — longitud de arco s [m]")
    ax2.set_ylabel("Distancia al eje de via [m]")
    ax2.set_title("Perfil de semianchos barridos (sobreancho geometrico por PK)")
    ax2.legend(); ax2.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)


# ----------------------------------------------------------------------------
# 5. MAIN
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    R = 25.0
    Lc = 10.0                       # clotoides de 10 m
    Larc = R * np.pi / 2.0          # 90 grados de curva circular
    track = Track([
        ("straight", 20.0),
        ("clothoid", Lc, 0.0, 1.0 / R),
        ("arc", Larc, 1.0 / R),
        ("clothoid", Lc, 1.0 / R, 0.0),
        ("straight", 20.0),
    ])

    with open("/home/claude/tram_5mod.json") as f:
        spec = json.load(f)
    tram = Tram(spec)

    total_len = sum(m["length"] for m in spec["modules"])
    # margen: el pivote trasero necesita quedar dentro del trazado
    s_start, s_end = total_len + 1.0, track.length - 2.0
    envelope, snapshots, chain = run_sweep(track, tram, s_start, s_end, step=0.20)
    profile = clearance_profile(track, envelope, step=0.25)

    export_dxf("/home/claude/out/huella_R25.dxf", track, envelope, snapshots)
    export_png("/home/claude/out/huella_R25.png", track, envelope, snapshots,
               profile, spec["body_width"], int(R))

    # Resumen numerico
    hw = spec["body_width"] / 2.0
    mask_arc = (profile[:, 0] > 30 + total_len * 0.5) & (profile[:, 0] < 30 + Larc)  # zona curva plena
    max_in = profile[:, 2].max()
    max_out = -profile[:, 1].min()
    lines = [
        f"Vehiculo: {spec['name']}",
        f"Trazado: recta 20 m + clotoide {Lc} m + arco R{R:.0f} ({Larc:.2f} m, 90 grados) + clotoide + recta",
        f"Semiancho de caja nominal: {hw:.3f} m (espejos: +{spec['mirror']['protrusion']:.2f} m)",
        f"Semiancho barrido maximo lado INTERIOR de curva: {max_in:.3f} m  (sobreancho {max_in - hw:+.3f} m)",
        f"Semiancho barrido maximo lado EXTERIOR de curva: {max_out:.3f} m (sobreancho {max_out - hw:+.3f} m)",
        f"Ancho total barrido maximo: {max_in + max_out:.3f} m (vs {spec['body_width']:.2f} m en recta + espejos)",
        f"Pasos de simulacion: {len(snapshots)}  |  poligonos unidos: {len(snapshots) * 7}",
    ]
    txt = "\n".join(lines)
    with open("/home/claude/out/resumen.txt", "w") as f:
        f.write(txt + "\n")
    print(txt)
