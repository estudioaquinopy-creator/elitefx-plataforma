import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos, hoyPY, ZONA } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import Portada from "@/components/Portada";
import { guardarTextos } from "../ajustes-actions";
import { crearClase, eliminarClase } from "./actions";

export const dynamic = "force-dynamic";

type Clase = { id: string; titulo: string; inicio: string; zoom_url: string };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const diaPY = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaPY = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

export default async function Calendario({ searchParams }: { searchParams: { m?: string; d?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const aj = await leerAjustes();
  const hoy = hoyPY();
  const m = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? (searchParams.m as string) : hoy.slice(0, 7);
  const [anio, mes] = m.split("-").map(Number);
  const dSel = Number(searchParams.d) || (m === hoy.slice(0, 7) ? Number(hoy.slice(8, 10)) : 1);

  const portada = <Portada url={aj.portada_calendario} clave="portada_calendario" ruta="/calendario" admin={perm.admin} titulo="Calendario" />;

  if (!perm.calendario) {
    return (
      <>
        <h1>Calendario</h1>
        {portada}
        <section className="box">
          <div className="tag">Solo miembros con membresía activa</div>
          <p className="mu">El calendario de sesiones en vivo está disponible mientras tu membresía esté vigente. Escríbenos desde Ayuda y soporte para activarlo o renovarlo.</p>
        </section>
      </>
    );
  }

  const desde = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0)).toISOString();
  const hasta = new Date(Date.UTC(anio, mes, 1, 3, 0, 0)).toISOString();
  const { data } = await createClient().from("clases").select("*").gte("inicio", desde).lt("inicio", hasta).order("inicio");
  const clases = (data ?? []) as Clase[];
  const porDia = new Map<number, Clase[]>();
  for (const c of clases) {
    const d = Number(diaPY(c.inicio).slice(8, 10));
    porDia.set(d, [...(porDia.get(d) ?? []), c]);
  }

  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7; // semana desde lunes
  const celdas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  const ant = new Date(Date.UTC(anio, mes - 2, 1)).toISOString().slice(0, 7);
  const sig = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 7);
  const delDia = porDia.get(dSel) ?? [];
  const fechaSel = m + "-" + String(dSel).padStart(2, "0");

  return (
    <>
      <h1>Calendario</h1>
      <p className="sub">{MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1)} {anio} · horario de Paraguay.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {portada}

      {perm.admin && (
        <>
          <details className="box adm">
            <summary>+ Crear nueva clase</summary>
            <form action={crearClase} className="fm">
              <label>Título<input name="titulo" placeholder="Trading en vivo" /></label>
              <div className="f2">
                <label>Fecha<input type="date" name="fecha" defaultValue={fechaSel} required /></label>
                <label>Hora (Paraguay)<input type="time" name="hora" required /></label>
              </div>
              <label>Enlace de Zoom de esta clase (si lo dejas vacío usa el general)<input type="url" name="zoom_url" placeholder="https://zoom.us/j/…" /></label>
              <button className="btn s">Crear clase</button>
            </form>
          </details>
          <details className="box adm">
            <summary>Enlace de Zoom general</summary>
            <form action={guardarTextos} className="fm">
              <input type="hidden" name="ruta" value="/calendario" />
              <label>Zoom general<input type="url" name="zoom_general" defaultValue={aj.zoom_general} placeholder="https://zoom.us/j/…" /></label>
              <button className="btn s">Guardar</button>
            </form>
          </details>
        </>
      )}

      <div className="cols">
        <section className="box">
          <div className="calnav">
            <Link href={"/calendario?m=" + ant}>←</Link>
            <b>{MESES[mes - 1]} {anio}</b>
            <Link href={"/calendario?m=" + sig}>→</Link>
          </div>
          <div className="cal">
            {["L", "M", "X", "J", "V", "S", "D"].map((w) => <div key={w} className="wd">{w}</div>)}
            {celdas.map((d, i) =>
              d === null ? (
                <div key={i} />
              ) : (
                <Link key={i} href={"/calendario?m=" + m + "&d=" + d} className={"cd" + (d === dSel ? " on" : "") + (m + "-" + String(d).padStart(2, "0") === hoy ? " hoy" : "")}>
                  {d}
                  {porDia.has(d) && <span className="ev">{porDia.get(d)!.length > 1 ? porDia.get(d)!.length + " clases" : horaPY(porDia.get(d)![0].inicio)}</span>}
                  {porDia.has(d) && <span className="dot" />}
                </Link>
              )
            )}
          </div>
        </section>

        <section className="box">
          <h2>{dSel} de {MESES[mes - 1]}</h2>
          {delDia.length === 0 && <p className="mu">No hay clases este día.</p>}
          {delDia.map((c) => {
            const zoom = c.zoom_url || aj.zoom_general;
            return (
              <div key={c.id} className="ses">
                <div className="dt">{horaPY(c.inicio)}</div>
                <div style={{ flex: 1 }}><b>{c.titulo}</b></div>
                {zoom ? <a className="btn s" href={zoom} target="_blank" rel="noopener noreferrer">Unirme por Zoom</a> : <span className="mu">Enlace pendiente</span>}
                {perm.admin && (
                  <form action={eliminarClase}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn g s">Eliminar</button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
