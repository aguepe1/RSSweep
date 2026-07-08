#!/usr/bin/env python3
"""Genera trazados de prueba en DXF para el sweep analysis.
Todos como LWPOLYLINE densificada (0.10 m) salvo el chicane, que usa
entidades LINE + ARC para probar esa via de importacion."""
import numpy as np
import ezdxf
from tram_sweep import Track

OUT = "/home/claude/out/"

def save_polyline_dxf(track, path, step=0.10):
    doc = ezdxf.new("R2010")
    doc.layers.add("EJE_VIA", color=3)
    msp = doc.modelspace()
    msp.add_lwpolyline(track.centerline(step), dxfattribs={"layer": "EJE_VIA"})
    doc.saveas(path)

# 1. Curva de referencia R25 con clotoides (90 grados)
R = 25.0
t1 = Track([("straight", 20), ("clothoid", 10, 0, 1/R), ("arc", R*np.pi/2, 1/R),
            ("clothoid", 10, 1/R, 0), ("straight", 20)])
save_polyline_dxf(t1, OUT + "trazado_1_R25_clotoides.dxf")

# 2. Bucle terminal R20 (250 grados) — caso extremo tipo raqueta de cochera
R = 20.0
arc_len = R * np.radians(250)
t2 = Track([("straight", 30), ("clothoid", 8, 0, 1/R), ("arc", arc_len, 1/R),
            ("clothoid", 8, 1/R, 0), ("straight", 30)])
save_polyline_dxf(t2, OUT + "trazado_2_bucle_terminal_R20.dxf")

# 3. Contracurva en S: R30 / R-30 con recta intermedia corta (6 m)
R = 30.0
a60 = R * np.radians(60)
t3 = Track([("straight", 15), ("clothoid", 8, 0, 1/R), ("arc", a60, 1/R),
            ("clothoid", 8, 1/R, 0), ("straight", 6),
            ("clothoid", 8, 0, -1/R), ("arc", a60, -1/R),
            ("clothoid", 8, -1/R, 0), ("straight", 15)])
save_polyline_dxf(t3, OUT + "trazado_3_contracurva_S.dxf")

# 4. Chicane tipo desvio: contracurvas R50 sin transiciones (LINE + ARC)
R = 50.0
ang = np.radians(14)
t4 = Track([("straight", 20), ("arc", R*ang, 1/R), ("arc", R*ang, -1/R), ("straight", 20)])
doc = ezdxf.new("R2010")
doc.layers.add("EJE_VIA", color=3)
msp = doc.modelspace()
# recta 1
p0 = t4.pos(0); p1 = t4.pos(20)
msp.add_line(tuple(p0), tuple(p1), dxfattribs={"layer": "EJE_VIA"})
# arco 1 (izquierda): centro a la izquierda del rumbo en s=20
th = t4.heading(20)
c1 = p1 + R * np.array([np.cos(th + np.pi/2), np.sin(th + np.pi/2)])
a_start = np.degrees(np.arctan2(p1[1]-c1[1], p1[0]-c1[0]))
msp.add_arc(tuple(c1), R, a_start, a_start + np.degrees(ang), dxfattribs={"layer": "EJE_VIA"})
# arco 2 (derecha)
s_m = 20 + R*ang
pm = t4.pos(s_m); thm = t4.heading(s_m)
c2 = pm + R * np.array([np.cos(thm - np.pi/2), np.sin(thm - np.pi/2)])
a_end = np.degrees(np.arctan2(pm[1]-c2[1], pm[0]-c2[0]))
# arco CCW de (a_end - ang) a a_end recorrido en sentido horario fisicamente;
# DXF ARC siempre CCW: definimos start/end para cubrir el mismo tramo
msp.add_arc(tuple(c2), R, a_end - np.degrees(ang), a_end, dxfattribs={"layer": "EJE_VIA"})
# recta final
s_f = s_m + R*ang
pf = t4.pos(s_f); pe = t4.pos(t4.length)
msp.add_line(tuple(pf), tuple(pe), dxfattribs={"layer": "EJE_VIA"})
doc.saveas(OUT + "trazado_4_chicane_LINE_ARC.dxf")

# 5. Curva amplia R100 (45 grados) — caso suave de linea comercial
R = 100.0
t5 = Track([("straight", 30), ("clothoid", 20, 0, 1/R), ("arc", R*np.pi/4, 1/R),
            ("clothoid", 20, 1/R, 0), ("straight", 30)])
save_polyline_dxf(t5, OUT + "trazado_5_R100_suave.dxf")

for n in range(1, 6):
    import glob
    f = glob.glob(OUT + f"trazado_{n}_*.dxf")[0]
    d = ezdxf.readfile(f)
    ents = list(d.modelspace())
    print(f, "->", [(e.dxftype()) for e in ents][:5], f"({len(ents)} entidades)")
