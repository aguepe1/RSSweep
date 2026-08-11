#!/usr/bin/env python3
"""Valida un DXF pro de BARRIDO con ezdxf (E4-2): audita el fichero, comprueba que
las capas normalizadas están presentes y resume las entidades. Sale con codigo != 0
si hay errores de auditoria o faltan capas. Uso: python tools/validate_dxf.py <fichero.dxf>
"""
import sys

try:
    import ezdxf
except ImportError:
    sys.exit("ezdxf no instalado: pip install ezdxf")

EXPECTED_LAYERS = {"EJE", "HUELLA", "ENV_KIN", "OBSTACULOS", "INVASIONES", "PK", "COTAS"}


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit("uso: validate_dxf.py <fichero.dxf>")
    path = sys.argv[1]

    doc = ezdxf.readfile(path)
    auditor = doc.audit()
    if len(auditor.errors) > 0:
        print("ERRORES DE AUDITORIA:")
        for e in auditor.errors:
            print("  -", e)
        return 1

    layers = {layer.dxf.name for layer in doc.layers}
    missing = EXPECTED_LAYERS - layers
    if missing:
        print("FALTAN CAPAS:", sorted(missing))
        print("presentes:", sorted(layers))
        return 1

    counts: dict[str, int] = {}
    for e in doc.modelspace():
        counts[e.dxftype()] = counts.get(e.dxftype(), 0) + 1

    print(f"OK — R{doc.dxfversion} · capas: {sorted(layers)}")
    print("entidades:", counts)
    # comprobaciones minimas de contenido pro
    for etype in ("POLYLINE", "TEXT"):
        if counts.get(etype, 0) == 0:
            print(f"AVISO: no hay entidades {etype}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
