import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos, hoyPY, ZONA } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import Portada from "@/components/Portada";
import { crearClase, eliminarClase, crearFijo, guardarFijo, eliminarFijo } from "./actions";
import { ocurrencias, type Fijo, type Ocurrencia } from "@/lib/horario";
import SesionCard from "@/components/SesionCard";
import { COLORES, tipoSesion } from "@/lib/sesiones";

export const dynamic = "force-dynamic";

type Clase = Ocurrencia;
const DIAS = [["1", "L"], ["2", "M"], ["3", "X"], ["4", "J"], ["5", "V"], ["6", "S"], ["7", "D"]];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const diaPY = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaPY = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

export default async function Calendario({ searchParams }: { searchParams: { s?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const aj = await leerAjustes();
  const hoy = hoyPY();
  // Semana (lunes a domingo) que contiene la fecha ?s=AAAA-MM-DD (por defecto, hoy).
  const base = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.s ?? "") ? (searchParams.s as string) : hoy;
  const [by, bm, bd] = base.split("-").map(Number);
  const dow = (new Date(Date.UTC(by, bm - 1, bd)).getUTCDay() + 6) % 7;
  const mas = (n: number) => new Date(Date.UTC(by, bm - 1, bd - dow + n)).toISOString().slice(0, 10);
  const dias7 = Array.from({ length: 7 }, (_, i) => mas(i));
  const lunes = dias7[0], domingo = dias7[6];
  const fmtCorto = (f: string) => Number(f.slice(8, 10)) + " " + MESES[Number(f.slice(5, 7)) - 1].slice(0, 3);

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

  const desde = new Date(lunes + "T00:00:00-03:00").toISOString();
  const hasta = new Date(mas(7) + "T00:00:00-03:00").toISOString();
  const { data } = await createClient().from("clases").select("*").gte("inicio", desde).lt("inicio", hasta).order("inicio");
  const sb = createClient();
  const { data: fx } = await sb.from("horario_fijo").select("*").order("hora");
  const fijos = ((fx ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
  const sueltas = ((data ?? []) as Omit<Clase, "fijo">[]).map((c) => ({ ...c, fijo: false }));
  const clases = [...sueltas, ...ocurrencias(fijos, lunes, 7)].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const porDia = new Map<string, Clase[]>();
  for (const c of clases) porDia.set(diaPY(c.inicio), [...(porDia.get(diaPY(c.inicio)) ?? []), c]);
  const NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const fechaSel = hoy >= lunes && hoy <= domingo ? hoy : lunes;

  return (
    <>
      <h1>Calendario</h1>
      <p className="sub">Semana del {fmtCorto(lunes)} al {fmtCorto(domingo)} · horario de Paraguay · recordatorio 30 minutos antes de cada sesión.</p>
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
                <label>Duración (minutos)<input type="number" name="duracion_min" defaultValue={90} min={15} max={720} step={5} required /></label>
              </div>
              <label>Enlace de Google Meet de esta clase<input type="url" name="zoom_url" placeholder="https://meet.google.com/abc-defg-hij" /></label>
              <button className="btn s">Crear clase</button>
            </form>
          </details>
          <details className="box adm">
            <summary>Horario fijo semanal (se repite todas las semanas)</summary>
            {fijos.map((f) => (
              <form key={f.id} action={guardarFijo} className="fm" style={{ borderTop: "1px solid var(--bd)", paddingTop: 10 }}>
                <input type="hidden" name="id" value={f.id} />
                <div className="f2">
                  <label>Título<input name="titulo" defaultValue={f.titulo} /></label>
                  <label>Hora (Paraguay)<input type="time" name="hora" defaultValue={f.hora.slice(0, 5)} required /></label>
                  <label>Duración (min)<input type="number" name="duracion_min" defaultValue={f.duracion_min ?? 90} min={15} max={720} step={5} required /></label>
                </div>
                <div className="dias">
                  {DIAS.map(([v, l]) => <label key={v}><input type="checkbox" name="dias" value={v} defaultChecked={f.dias.includes(Number(v))} /> {l}</label>)}
                  <label><input type="checkbox" name="activo" defaultChecked={f.activo} /> Activa</label>
                </div>
                <label>Enlace de Meet de esta sesión<input type="url" name="zoom_url" defaultValue={f.zoom_url} /></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn s">Guardar</button>
                  <button className="btn g s" formAction={eliminarFijo}>Eliminar</button>
                </div>
              </form>
            ))}
            <form action={crearFijo} className="fm" style={{ borderTop: "1px solid var(--bd)", paddingTop: 10 }}>
              <b>Nueva sesión fija</b>
              <div className="f2">
                <label>Título<input name="titulo" placeholder="Trading en vivo" /></label>
                <label>Hora (Paraguay)<input type="time" name="hora" required /></label>
                <label>Duración (min)<input type="number" name="duracion_min" defaultValue={90} min={15} max={720} step={5} required /></label>
              </div>
              <div className="dias">{DIAS.map(([v, l]) => <label key={v}><input type="checkbox" name="dias" value={v} /> {l}</label>)}</div>
              <button className="btn s">Agregar</button>
            </form>
          </details>
        </>
      )}

      <section className="box">
        <div className="calnav">
          <Link href={"/calendario?s=" + mas(-7)} aria-label="Semana anterior">←</Link>
          <b>{fmtCorto(lunes)} – {fmtCorto(domingo)} {domingo.slice(0, 4)}</b>
          <Link href={"/calendario?s=" + mas(7)} aria-label="Semana siguiente">→</Link>
        </div>
        {!(hoy >= lunes && hoy <= domingo) && <p style={{ textAlign: "center", margin: "0 0 12px" }}><Link href="/calendario" className="lk">Volver a esta semana</Link></p>}
        <div className="leyenda">{Object.values(COLORES).map((t) => <span key={t.nombre}><i style={{ background: t.color }} />{t.nombre}</span>)}</div>
        <div className="sem">
          {dias7.map((f, i) => {
            const lista = porDia.get(f) ?? [];
            return (
              <div key={f} className={"sdia" + (f === hoy ? " hoy" : "")}>
                <div className="sdh"><span>{NOMBRES[i]}</span><b>{Number(f.slice(8, 10))}</b></div>
                {lista.length === 0 && <p className="mu sv">Sin sesiones</p>}
                {lista.map((c) => {
                  const t = COLORES[tipoSesion(c.titulo)];
                  return (
                    <SesionCard
                      key={c.id}
                      titulo={c.titulo}
                      inicio={c.inicio}
                      zoom={c.zoom_url}
                      color={t.color}
                      tipo={t.nombre}
                      extra={perm.admin && !c.fijo ? (
                        <form action={eliminarClase}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn g s">Eliminar esta sesión</button>
                        </form>
                      ) : null}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
