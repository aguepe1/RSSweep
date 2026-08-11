// XLSX export (E4-3): el escritor propio `buildXlsx` produce un ZIP OOXML válido y
// `profileTable` reproduce exactamente las columnas/valores del CSV de perfil.
import { describe, it, expect } from "vitest";
import engine, { type Vehicle, type Track } from "./_engine";

function ascii(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("buildXlsx — ZIP OOXML válido", () => {
  const xlsx = engine.buildXlsx([
    {
      name: "Hoja",
      headers: ["a", "b"],
      rows: [
        [1, "x"],
        [2.5, { v: "⚠", fill: "red" }],
      ],
      cols: [10, 12],
    },
  ]);

  it("empieza por la firma ZIP local y contiene el EOCD", () => {
    expect([xlsx[0], xlsx[1], xlsx[2], xlsx[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(ascii(xlsx)).toContain("PK\x05\x06"); // end of central directory
  });

  it("incluye las partes OOXML obligatorias", () => {
    const s = ascii(xlsx);
    for (const part of [
      "[Content_Types].xml",
      "xl/workbook.xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "<sheetData>",
    ]) {
      expect(s, part).toContain(part);
    }
  });
});

describe("profileTable — paridad con el CSV de perfil", () => {
  function build(id: string): Track {
    return engine.TRACK_PRESETS.find((p) => p.id === id)!.build();
  }
  function veh(id: string): Vehicle {
    return structuredClone(engine.VEHICLE_PRESETS.find((p) => p.id === id)!.vehicle);
  }

  it("geo: mismas columnas que el CSV y ancho = izq − dcha", () => {
    const sw = engine.runSweep(build("r25"), veh("urbos5"), { step: 0.5 });
    const tbl = engine.profileTable(sw, (s) => s);
    // cabecera idéntica al CSV geométrico del controlador
    expect(tbl.headers.join(";")).toBe("pk_m;offset_dcha_m;offset_izq_m;ancho_m");
    expect(tbl.rows.length).toBe(sw.rows!.length);
    for (const row of tbl.rows) {
      const [, dcha, izq, ancho] = row as number[];
      // izq/dcha/ancho se redondean por separado a 4 dp → tolerancia 1e-4
      expect(ancho).toBeCloseTo(izq - dcha, 3);
    }
  });

  it("con cinemática añade las 3 columnas kin y su ancho", () => {
    const kin = engine.defaultKin();
    kin.enabled = true;
    const sw = engine.runSweep(build("r25"), veh("urbos5"), { step: 0.5, kin });
    const tbl = engine.profileTable(sw, (s) => s);
    expect(tbl.headers).toEqual([
      "pk_m",
      "offset_dcha_m",
      "offset_izq_m",
      "ancho_m",
      "kin_dcha_m",
      "kin_izq_m",
      "kin_ancho_m",
    ]);
    const row = tbl.rows[0] as number[];
    expect(row[6]).toBeCloseTo(Math.round((row[5] - row[4]) * 1e4) / 1e4, 6);
  });
});
