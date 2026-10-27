// Lectura del reporte de historial de MetaTrader 5 (HTML o XLSX; también CSV).
// Todo ocurre en el navegador: el archivo no se sube, solo se envían las operaciones ya leídas.

export type OpMT5 = {
  ticket: string;
  par: string;
  direccion: "compra" | "venta";
  volumen: number | null;
  apertura: string | null; // "AAAA-MM-DD HH:MM:SS" (hora del servidor del broker)
  cierre: string | null;
  precio_ap: number | null;
  precio_ci: number | null;
  comision: number;
  swap: number;
  resultado: number; // beneficio + comisión + swap
};

export type Lectura = { ops: OpMT5[]; modo: "posiciones" | "transacciones"; avisos: string[] };

const norm = (h: string) => (h || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SYM = ["symbol", "simbolo", "instrumento"];
const TIPO = ["type", "tipo"];
const VOL = ["volume", "volumen"];
const BEN = ["profit", "beneficio", "ganancia", "resultado"];
const POS = ["position", "posicion", "ticket"];
const HORA = ["time", "hora", "tiempo", "fecha"];
const PRECIO = ["price", "precio"];
const COM = ["commission", "comision"];
const DIR = ["direction", "direccion"];
const DEAL = ["deal", "transaccion", "operacion", "trato"];

const RE_FECHA = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

function fecha(s: string): string | null {
  const t = (s || "").trim();
  const m = t.match(RE_FECHA);
  if (m) return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + (m[6] ?? "00");
  if (/^\d{5}(\.\d+)?$/.test(t)) { // fecha de Excel (número de serie)
    const d = new Date(Math.round((Number(t) - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10) + " " + d.toISOString().slice(11, 19);
  }
  return null;
}

function num(s: string | undefined): number | null {
  if (s == null) return null;
  let t = s.replace(/[\s ]/g, "");
  if (!t || t === "-") return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function tipo(s: string): "compra" | "venta" | null {
  const t = norm(s);
  if (t.startsWith("buy") || t.startsWith("compra")) return "compra";
  if (t.startsWith("sell") || t.startsWith("venta")) return "venta";
  return null;
}

const idx = (cab: string[], toks: string[]) => cab.findIndex((c) => toks.includes(c));
const idxs = (cab: string[], toks: string[]) => cab.map((c, i) => (toks.includes(c) ? i : -1)).filter((i) => i >= 0);

// Convierte las filas (texto de cada celda) en operaciones.
export function interpretar(filas: string[][]): Lectura {
  const avisos: string[] = [];
  // 1) Tabla de POSICIONES (una fila por operación cerrada).
  for (let h = 0; h < filas.length; h++) {
    const cab = filas[h].map(norm);
    if (!(idx(cab, SYM) >= 0 && idx(cab, TIPO) >= 0 && idx(cab, VOL) >= 0 && idx(cab, BEN) >= 0)) continue;
    const tiempos = idxs(cab, HORA), precios = idxs(cab, PRECIO);
    const iPos = idx(cab, POS);
    if (tiempos.length < 2 || iPos < 0 || idx(cab, DIR) >= 0) continue;
    const m = { pos: iPos, sym: idx(cab, SYM), tipo: idx(cab, TIPO), vol: idx(cab, VOL), ben: idx(cab, BEN), com: idx(cab, COM), swap: idx(cab, ["swap"]) };
    const ops: OpMT5[] = [];
    for (let r = h + 1; r < filas.length; r++) {
      const f = filas[r];
      const c = f.map(norm);
      if (idx(c, SYM) >= 0 && idx(c, TIPO) >= 0) break; // empezó otra sección (órdenes, transacciones…)
      const d0 = f.findIndex((x) => fecha(x));
      if (d0 < 0) continue;
      const off = d0 - tiempos[0];
      const g = (i: number) => (i >= 0 ? f[i + off] : undefined);
      const dir = tipo(g(m.tipo) ?? "");
      const par = (g(m.sym) ?? "").trim().toUpperCase();
      const cierre = fecha(g(tiempos[1]) ?? "");
      const ben = num(g(m.ben));
      if (!dir || !par || !cierre || ben == null) continue;
      const com = num(g(m.com)) ?? 0, sw = num(g(m.swap)) ?? 0;
      ops.push({
        ticket: (g(m.pos) ?? "").trim(),
        par, direccion: dir,
        volumen: num((g(m.vol) ?? "").split("/")[0]),
        apertura: fecha(g(tiempos[0]) ?? ""), cierre,
        precio_ap: precios[0] != null ? num(g(precios[0])) : null,
        precio_ci: precios[1] != null ? num(g(precios[1])) : null,
        comision: com, swap: sw, resultado: Math.round((ben + com + sw) * 100) / 100,
      });
    }
    if (ops.length) return { ops: ops.filter((o) => o.ticket), modo: "posiciones", avisos };
  }
  // 2) Alternativa: tabla de TRANSACCIONES (cada cierre es una fila con dirección "out").
  for (let h = 0; h < filas.length; h++) {
    const cab = filas[h].map(norm);
    if (!(idx(cab, SYM) >= 0 && idx(cab, TIPO) >= 0 && idx(cab, DIR) >= 0 && idx(cab, BEN) >= 0)) continue;
    const iT = idx(cab, HORA);
    if (iT < 0) continue;
    const m = { deal: idx(cab, DEAL), sym: idx(cab, SYM), tipo: idx(cab, TIPO), dir: idx(cab, DIR), vol: idx(cab, VOL), pr: idx(cab, PRECIO), com: idx(cab, COM), swap: idx(cab, ["swap"]), ben: idx(cab, BEN) };
    const ops: OpMT5[] = [];
    for (let r = h + 1; r < filas.length; r++) {
      const f = filas[r];
      const d0 = f.findIndex((x) => fecha(x));
      if (d0 < 0) continue;
      const off = d0 - iT;
      const g = (i: number) => (i >= 0 ? f[i + off] : undefined);
      const sal = norm(g(m.dir) ?? "");
      if (!(sal.includes("out") || sal.includes("salida"))) continue;
      const t = tipo(g(m.tipo) ?? "");
      const par = (g(m.sym) ?? "").trim().toUpperCase();
      const ben = num(g(m.ben));
      const cierre = fecha(g(iT) ?? "");
      if (!t || !par || !cierre || ben == null) continue;
      const com = num(g(m.com)) ?? 0, sw = num(g(m.swap)) ?? 0;
      const id = (g(m.deal >= 0 ? m.deal : iT + 1) ?? "").trim();
      ops.push({
        ticket: "D" + id, par, direccion: t === "venta" ? "compra" : "venta", // una venta de cierre cerró una compra
        volumen: num(g(m.vol)), apertura: null, cierre, precio_ap: null, precio_ci: num(g(m.pr)),
        comision: com, swap: sw, resultado: Math.round((ben + com + sw) * 100) / 100,
      });
    }
    if (ops.length) {
      avisos.push("Este reporte trae transacciones (no posiciones): no incluye la hora de apertura ni la comisión de entrada. Para más detalle, exporta el reporte con la vista de posiciones.");
      return { ops: ops.filter((o) => o.ticket.length > 1), modo: "transacciones", avisos };
    }
  }
  return { ops: [], modo: "posiciones", avisos };
}

// ---- Lectura de archivos ----

function decodificar(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u);
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u);
  let ceros = 0;
  for (let i = 0; i < Math.min(u.length, 400); i++) if (u[i] === 0) ceros++;
  if (ceros > 40) return new TextDecoder("utf-16le").decode(u); // los reportes de MT5 suelen venir en UTF-16
  try { return new TextDecoder("utf-8", { fatal: true }).decode(u); } catch { return new TextDecoder("windows-1252").decode(u); }
}

function filasHtml(texto: string): string[][] {
  const doc = new DOMParser().parseFromString(texto, "text/html");
  return Array.from(doc.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).filter((c) => c.tagName === "TD" || c.tagName === "TH").map((c) => (c.textContent || "").replace(/[\s ]+/g, " ").trim())
  );
}

function filasCsv(texto: string): string[][] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const primera = lineas[0] ?? "";
  const d = [";", "\t", ","].map((x) => [x, primera.split(x).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return lineas.map((l) => l.split(d).map((x) => x.replace(/^"|"$/g, "").trim()));
}

async function filasXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const z = unzipSync(new Uint8Array(buf));
  const xml = (k: string) => new DOMParser().parseFromString(strFromU8(z[k]), "application/xml");
  const compartidas: string[] = [];
  if (z["xl/sharedStrings.xml"]) {
    for (const si of Array.from(xml("xl/sharedStrings.xml").getElementsByTagName("si"))) {
      compartidas.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent || "").join(""));
    }
  }
  const hojas = Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  if (!hojas.length) throw new Error("El archivo Excel no tiene hojas.");
  const out: string[][] = [];
  for (const row of Array.from(xml(hojas[0]).getElementsByTagName("row"))) {
    const f: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = (c.getAttribute("r") || "").replace(/\d+/g, "");
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      col = Math.max(0, col - 1);
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let valor = v;
      if (t === "s") valor = compartidas[Number(v)] ?? "";
      else if (t === "inlineStr") valor = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent || "").join("");
      while (f.length < col) f.push("");
      f[col] = (valor || "").replace(/[\s ]+/g, " ").trim();
    }
    out.push(f);
  }
  return out;
}

export async function leerReporte(archivo: File): Promise<Lectura> {
  const buf = await archivo.arrayBuffer();
  const nombre = archivo.name.toLowerCase();
  let filas: string[][];
  if (nombre.endsWith(".xlsx")) filas = await filasXlsx(buf);
  else if (nombre.endsWith(".xls")) throw new Error("Guarda el reporte como XLSX (no XLS) o como HTML.");
  else if (nombre.endsWith(".csv")) filas = filasCsv(decodificar(buf));
  else filas = filasHtml(decodificar(buf));
  return interpretar(filas);
}
