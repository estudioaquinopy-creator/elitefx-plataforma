"use client";
import { useState } from "react";
import { leerReporte, type Lectura } from "@/lib/mt5";
import { importarOperaciones } from "@/app/(app)/journal/actions";

const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });

export default function ImportarMT5() {
  const [lec, setLec] = useState<Lectura | null>(null);
  const [nombre, setNombre] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setLec(null); setErr(""); setMsg("");
    if (!f) return;
    setNombre(f.name); setLeyendo(true);
    try {
      const r = await leerReporte(f);
      if (!r.ops.length) setErr("No encontré operaciones en este archivo. Exporta el reporte del historial desde MT5 (Historial → clic derecho → Reporte → HTML o Excel) y vuelve a subirlo.");
      else setLec(r);
    } catch (x) {
      setErr("No pude leer el archivo: " + (x as Error).message);
    }
    setLeyendo(false);
  }

  async function importar() {
    if (!lec) return;
    setSubiendo(true); setErr(""); setMsg("");
    let nuevas = 0, repetidas = 0;
    for (let i = 0; i < lec.ops.length; i += 300) {
      const r = await importarOperaciones(lec.ops.slice(i, i + 300));
      if (!r.ok) { setErr(r.error || "No se pudo guardar."); setSubiendo(false); return; }
      nuevas += r.nuevas; repetidas += r.repetidas;
    }
    setSubiendo(false);
    setLec(null);
    setMsg(nuevas + " operaciones nuevas importadas" + (repetidas ? " · " + repetidas + " ya estaban y se omitieron." : "."));
  }

  const neto = lec ? lec.ops.reduce((a, o) => a + o.resultado, 0) : 0;
  const fechas = lec ? lec.ops.map((o) => (o.cierre || o.apertura || "").slice(0, 10)).filter(Boolean).sort() : [];

  return (
    <div className="fm">
      <label>Reporte de MetaTrader 5 (HTML o XLSX)
        <input type="file" accept=".html,.htm,.xlsx,.csv" onChange={elegir} disabled={subiendo} />
      </label>
      {leyendo && <p className="mu">Leyendo {nombre}…</p>}
      {err && <p className="alerta">{err}</p>}
      {msg && <p className="okmsg">{msg}</p>}
      {lec && (
        <div className="box" style={{ marginTop: 4 }}>
          <p><b>{lec.ops.length}</b> operaciones encontradas · del {fechas[0]} al {fechas[fechas.length - 1]} · resultado {money(neto)}</p>
          {lec.avisos.map((a, i) => <p key={i} className="mu">{a}</p>)}
          <button type="button" className="btn sd" onClick={importar} disabled={subiendo}>{subiendo ? "Importando…" : "Importar " + lec.ops.length + " operaciones"}</button>
        </div>
      )}
    </div>
  );
}
