#!/usr/bin/env python3
"""Ensamblado provisional: inyecta engine.js y ui.js en app_shell.html."""
shell = open("src/app_shell.html").read()
engine = open("src/engine.js").read().replace('if (typeof module !== "undefined") {', 'if (false) {')
ui = open("src/ui.js").read()
open("dist/barrido_sweep_app.html", "w").write(shell.replace("/*__ENGINE__*/", engine).replace("/*__UI__*/", ui))
print("dist/barrido_sweep_app.html generado")
