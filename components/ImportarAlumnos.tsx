"use client";
import { useState } from "react";
import type { FilaImp, ResImp } from "@/app/(app)/accesos/importar/actions";

type Fila = FilaImp & { linea: number; problema?: string };
const ALIAS: Record<string, string[]> = {
  nombre: ["nombre", "name", "nombre completo", "full name", "nombre y apellido", "alumno", "member"],
  nombre1: ["first name", "firstname", "primer nombre"],
  apellido: ["apellido", "last name", "lastname", "apellidos"],
  email: ["email", "correo", "e-mail", "mail", "correo electronico", "correo electrónico"],
  telefono: ["telefono", "teléfono", "phone", "celular", "whatsapp", "movil", "móvil", "tel"],
  plan: ["plan", "membresia", "membresía", "tipo", "nivel"],
  vence: ["vence", "vencimiento", "expira", "expiry", "fecha de vencimiento", "valid until", "hasta", "calendario hasta"],
};
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function parseCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/)[0] ?? "";
  const delim = [";", "\t", ","].map((d) => [d, primera.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: string[][] = [];
  let fila: string[] = [], cel = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c;
    } else if (c === '"') q = true;
    else if (c === delim) { fila.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; fila.push(cel); filas.push(fila); fila = []; cel = ""; }
    else cel += c;
  }
  if (cel.length || fila.length) { fila.push(cel); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim()));
}

function normPlan(v: string, def: string): string {
  const x = norm(v);
  if (!x) return def;
  if (/scanner/.test(x)) return "scanner";
  if (/^(gratis|free|gratuito|0)$/.test(x)) return "gratis";
  if (/live|miembro|member|pago|premium|vip|paid|activo/.test(x)) return "live_trading";
  return "?";
}
function normFecha(v: string): string {
  const x = (v || "").trim();
  if (!x) return "";
  let m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = x.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "?";
}

export default function ImportarAlumnos({ enviar }: { enviar: (f: FilaImp[], actualizar: boolean, invitar: boolean) => Promise<ResImp[]> }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [planDef, setPlanDef] = useState("gratis");
  const [venceDef, setVenceDef] = useState("");
  const [actualizar, setActualizar] = useState(false);
  const [invitar, setInvitar] = useState(true);
  const [pendientes, setPendientes] = useState<FilaImp[]>([]);
  const [aviso, setAviso] = useState("");
  const [corriendo, setCorriendo] = useState(false);
  const [hechos, setHechos] = useState(0);
  const [res, setRes] = useState<ResImp[] | null>(null);

  async function leer(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setRes(null); setAviso("");
    if (!f) return;
    setNombreArchivo(f.name);
    const buf = await f.arrayBuffer();
    let texto: string;
    try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = new TextDecoder("windows-1252").decode(buf); }
    const tabla = parseCSV(texto);
    if (tabla.length < 2) { setFilas([]); return setAviso("No encontré filas en el archivo."); }
    const cab = tabla[0].map(norm);
    const col = (k: string) => cab.findIndex((h) => ALIAS[k].map(norm).includes(h));
    const ix = { nombre: col("nombre"), n1: col("nombre1"), ap: col("apellido"), email: col("email"), tel: col("telefono"), plan: col("plan"), vence: col("vence") };
    if (ix.email < 0) { setFilas([]); return setAviso("No encontré la columna del correo. La primera fila debe tener los títulos (por ejemplo: nombre, email, telefono, plan, vence)."); }
    const vistos = new Set<string>();
    const out: Fila[] = tabla.slice(1).map((r, i) => {
      const g = (n: number) => (n >= 0 ? (r[n] ?? "").trim() : "");
      const nombre = g(ix.nombre) || [g(ix.n1), g(ix.ap)].filter(Boolean).join(" ");
      return { linea: i + 2, nombre, email: g(ix.email).toLowerCase(), telefono: g(ix.tel), plan: g(ix.plan), vence: g(ix.vence) };
    });
    setFilas(out.map((f) => {
      let problema = "";
      if (!/^\S+@\S+\.\S+$/.test(f.email)) problema = "Correo no válido";
      else if (vistos.has(f.email)) problema = "Correo repetido en el archivo";
      vistos.add(f.email);
      return { ...f, problema };
    }));
  }

  // Aplica planes y fechas (con los valores por defecto) a cada fila.
  const lista: Fila[] = filas.map((f) => {
    if (f.problema) return f;
    const plan = normPlan(f.plan, planDef);
    const vence = plan === "gratis" ? "" : (normFecha(f.vence) || venceDef);
    let problema = "";
    if (plan === "?") problema = "Plan no reconocido: " + f.plan;
    else if (vence === "?") problema = "Fecha no válida: " + f.vence;
    return { ...f, plan: plan === "?" ? f.plan : plan, vence, problema };
  });
  const buenas = lista.filter((f) => !f.problema);
  const malas = lista.filter((f) => f.problema);
  const pagos = buenas.filter((f) => f.plan !== "gratis").length;
  const sinFecha = buenas.filter((f) => f.plan !== "gratis" && !f.vence).length;

  async function importar() {
    setCorriendo(true); setRes(null); setHechos(0); setPendientes([]);
    const acumulado: ResImp[] = [];
    const tam = invitar ? 10 : 25;
    let pend: FilaImp[] = [];
    for (let i = 0; i < buenas.length; i += tam) {
      const lote = buenas.slice(i, i + tam).map(({ nombre, email, telefono, plan, vence }) => ({ nombre, email, telefono, plan, vence }));
      let r: ResImp[];
      try { r = await enviar(lote, actualizar, invitar); }
      catch (e) { r = lote.map((l) => ({ email: l.email, estado: "error" as const, detalle: (e as Error).message })); }
      acumulado.push(...r);
      setHechos(Math.min(i + tam, buenas.length));
      const hechosEmails = new Set(r.map((x) => x.email));
      const limite = r.some((x) => x.estado === "limite");
      const sinProcesar = lote.filter((l) => !hechosEmails.has(l.email));
      const conLimite = lote.filter((l) => r.some((x) => x.email === l.email && x.estado === "limite"));
      if (limite) {
        pend = [...conLimite, ...sinProcesar, ...buenas.slice(i + tam).map(({ nombre, email, telefono, plan, vence }) => ({ nombre, email, telefono, plan, vence }))];
        break;
      }
      if (invitar) await new Promise((ok) => setTimeout(ok, 800));
    }
    setPendientes(pend);
    setRes(acumulado.filter((x) => x.estado !== "limite")); setCorriendo(false);
  }

  function descargar(nombre: string, contenido: string) {
    const url = URL.createObjectURL(new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url);
  }
  const cuenta = (s: string) => res?.filter((r) => r.estado === s).length ?? 0;

  return (
    <>
      <section className="box">
        <h2>1. Prepara tu archivo</h2>
        <p className="mu">Un CSV con una fila por alumno. Solo el <b>correo</b> es obligatorio. Columnas que reconozco: <b>nombre</b>, <b>email</b>, <b>telefono</b>, <b>plan</b> (gratis, live_trading o scanner) y <b>vence</b> (fecha hasta la que tiene calendario, como 2026-12-31 o 31/12/2026).</p>
        <button type="button" className="btn g s" onClick={() => descargar("plantilla-alumnos.csv", "nombre,email,telefono,plan,vence\nMaría Pérez,maria@ejemplo.com,595981123456,live_trading,2026-12-31\nJuan Gómez,juan@ejemplo.com,595982654321,gratis,\n")}>Descargar plantilla</button>
      </section>

      <section className="box fm">
        <h2>2. Sube el archivo</h2>
        <label>Archivo CSV<input type="file" accept=".csv,text/csv" onChange={leer} /></label>
        <div className="f2">
          <label>Plan para las filas sin plan
            <select value={planDef} onChange={(e) => setPlanDef(e.target.value)}>
              <option value="gratis">Miembro gratuito</option><option value="live_trading">Live Trading</option><option value="scanner">Scanner</option>
            </select>
          </label>
          <label>Calendario activo hasta (para las filas de pago sin fecha)<input type="date" value={venceDef} onChange={(e) => setVenceDef(e.target.value)} /></label>
        </div>
        <label className="ck"><input type="checkbox" checked={invitar} onChange={(e) => setInvitar(e.target.checked)} /> <span><b>Enviar correo de invitación a cada alumno</b> para que cree su contraseña y entre (recomendado)</span></label>
        <label className="ck"><input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} /> Si el correo ya tiene cuenta, actualizar su plan, vencimiento, nombre y teléfono</label>
        {aviso && <p className="alerta">{aviso}</p>}
      </section>

      {lista.length > 0 && !res && (
        <section className="box">
          <h2>3. Revisa y confirma</h2>
          <p><b>{buenas.length}</b> alumnos listos para importar{malas.length > 0 && <> · <span style={{ color: "var(--co)" }}>{malas.length} con problemas (se omiten)</span></>}. De ellos, {pagos} son de pago.</p>
          {sinFecha > 0 && <p className="alerta">{sinFecha} alumno(s) de pago no tienen fecha de vencimiento: quedarán "Sin calendario" hasta que les pongas una. Puedes elegir una fecha arriba para todos.</p>}
          <div className="tbl">
            {lista.slice(0, 8).map((f) => (
              <div key={f.linea} className="ses"><div style={{ flex: 1, minWidth: 0 }}><b>{f.nombre || f.email}</b><small className="mu" style={{ display: "block", overflowWrap: "anywhere" }}>{f.email} · {f.plan || planDef}{f.vence ? " · vence " + f.vence : ""}{f.problema ? " · ⚠ " + f.problema : ""}</small></div></div>
            ))}
            {lista.length > 8 && <p className="mu">… y {lista.length - 8} más.</p>}
          </div>
          {malas.length > 0 && <details><summary>Ver filas con problemas ({malas.length})</summary>{malas.slice(0, 50).map((f) => <p key={f.linea} className="mu" style={{ margin: "4px 0" }}>Fila {f.linea}: {f.email || "(sin correo)"} — {f.problema}</p>)}</details>}
          {invitar
            ? <p className="mu">Se enviará un correo de invitación a cada uno ({buenas.length} correos). Si alguien ya tiene cuenta pero nunca entró, se le reenvía. Tu servicio de correo tiene un límite de envíos por hora y por día: si se alcanza, la importación se detiene y te dejo descargar las filas que faltan para continuar después.</p>
            : <p className="mu">No se enviará ningún correo. Las cuentas se crean listas y cada alumno entra con <b>"¿Olvidaste tu contraseña?"</b> en el login.</p>}
          <button type="button" className="btn sd" disabled={corriendo || buenas.length === 0} onClick={importar}>{corriendo ? "Importando… " + hechos + " de " + buenas.length : (invitar ? "Importar y enviar " : "Importar ") + buenas.length + " alumnos"}</button>
          {corriendo && <div className="bar" style={{ marginTop: 12 }}><i style={{ width: Math.round((hechos / Math.max(1, buenas.length)) * 100) + "%" }} /></div>}
        </section>
      )}

      {res && (
        <section className="box">
          <h2>Resultado</h2>
          <p className="okmsg">{cuenta("invitado") + cuenta("creado")} cuentas creadas{invitar ? " con invitación enviada" : ""} · {cuenta("reenviado")} invitaciones reenviadas · {cuenta("actualizado")} actualizadas · {cuenta("existe")} ya existían · {cuenta("error")} con error.</p>
          {pendientes.length > 0 && (
            <>
              <p className="alerta">Se alcanzó el límite de envío de correos. Faltan {pendientes.length} alumnos. Espera un rato (o al día siguiente) y sube de nuevo este archivo con solo las filas pendientes.</p>
              <button type="button" className="btn sd" onClick={() => descargar("alumnos-pendientes.csv", "nombre,email,telefono,plan,vence\n" + pendientes.map((f) => [f.nombre, f.email, f.telefono, f.plan, f.vence].map((x) => '"' + String(x ?? "").replace(/"/g, '""') + '"').join(",")).join("\n"))}>Descargar las {pendientes.length} filas pendientes</button>
            </>
          )}
          {res.some((r) => r.estado === "error" || r.estado === "existe") && (
            <button type="button" className="btn g s" onClick={() => descargar("informe-importacion.csv", "email,estado,detalle\n" + res.filter((r) => r.estado === "error" || r.estado === "existe").map((r) => [r.email, r.estado, '"' + (r.detalle ?? "").replace(/"/g, '""') + '"'].join(",")).join("\n"))}>Descargar informe de problemas</button>
          )}
        </section>
      )}
    </>
  );
}
