"use client";
import { useState } from "react";
import { aprobarPorCsv } from "@/app/(app)/accesos/actions";

// Lee el CSV de clientes de Liquid en el navegador, deja elegir la columna con el número de cuenta y aprueba
// las cuentas pendientes que aparezcan en esa columna (solo esa columna: así un monto o un saldo no puede coincidir).
function filas(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((s) => [s, primera.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let fila: string[] = [], celda = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { celda += '"'; i++; } else q = false; } else celda += c; }
    else if (c === '"') q = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; fila.push(celda); out.push(fila); fila = []; celda = ""; }
    else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); out.push(fila); }
  return out.filter((f) => f.some((x) => x.trim() !== ""));
}

export default function SubirCsvLiquid() {
  const [datos, setDatos] = useState<string[][]>([]);
  const [col, setCol] = useState(0);
  const [nombre, setNombre] = useState("");
  const [err, setErr] = useState("");

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErr(""); setDatos([]);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErr("El archivo es demasiado grande (máximo 5 MB).");
    const d = filas(await f.text());
    if (d.length < 2) return setErr("No se pudo leer el archivo: parece estar vacío o no es un CSV.");
    setNombre(f.name); setDatos(d);
    const enc = d[0].map((x) => x.toLowerCase());
    const guess = enc.findIndex((x) => /cuenta|account|login|trading/.test(x));
    setCol(guess >= 0 ? guess : 0);
  }

  const encabezado = datos[0] ?? [];
  const valores = datos.slice(1).map((f) => (f[col] ?? "").trim()).filter(Boolean);
  const muestra = valores.slice(0, 3).join(", ");

  return (
    <form action={aprobarPorCsv} className="fm">
      <label>Archivo CSV de clientes de Liquid
        <input type="file" accept=".csv,text/csv,text/plain" onChange={elegir} />
      </label>
      {err && <p className="alerta">{err}</p>}
      {datos.length > 0 && (
        <>
          <label>Columna con el número de cuenta de trading
            <select value={col} onChange={(e) => setCol(Number(e.target.value))}>
              {encabezado.map((h, i) => <option key={i} value={i}>{h.trim() || "Columna " + (i + 1)}</option>)}
            </select>
          </label>
          <small className="mu">{nombre} · {valores.length} filas · ejemplo: {muestra || "—"}</small>
          <input type="hidden" name="cuentas" value={JSON.stringify(valores)} />
          <button className="btn s">Aprobar las cuentas que estén en el CSV</button>
        </>
      )}
    </form>
  );
}
