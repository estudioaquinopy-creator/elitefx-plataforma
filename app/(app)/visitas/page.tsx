import { createClient } from "@/lib/supabase/server";
import { perfilActual, hoyPY, vipVigente } from "@/lib/sesion";
import { HORAS, TEMAS, proximosMiercoles, visitaVigente, fechaLarga, horaCorta, whatsapp } from "@/lib/visitas";
import { agendarVisita, cancelarVisita, revisarVisita, proponerHorario, responderPropuesta } from "./actions";
import { leerAjustes } from "@/lib/ajustes";
import FormVisita from "@/components/FormVisita";

export const dynamic = "force-dynamic";

type Visita = { id: string; user_id: string; fecha: string; hora: string; tema: string; detalle: string; estado: string; nota: string; created_at: string; revisado_at?: string | null; encargado_id?: string | null; encargado_nombre?: string; propuesta_fecha?: string | null; propuesta_hora?: string | null };
const ETIQ: Record<string, string> = { pendiente: "Pendiente de aprobación", aprobada: "Aprobada", propuesta: "Nuevo horario propuesto", rechazada: "Rechazada", cancelada: "Cancelada" };
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default async function Visitas({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const perfil = await perfilActual();
  const sb = createClient();
  const hoy = hoyPY();
  const admin = perfil.rol === "admin"; // en modo alumno se comporta como alumno (perfilActual cambia el rol)
  const vip = admin || (vipVigente(perfil) && !perfil.prueba_hasta);
  const msgs = (
    <>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
    </>
  );

  if (!vip) {
    return (
      <>
        <h1>Agendar visita</h1>
        <section className="box"><div className="tag">{perfil.prueba_hasta ? "No incluido en la prueba" : perfil.plan !== "gratis" ? "Tu membresía VIP venció" : "Solo miembros VIP"}</div><p className="mu">{perfil.prueba_hasta ? "Las visitas a la oficina no están incluidas en la prueba gratuita. " : ""}Los miembros VIP pueden visitar nuestras oficinas para resolver dudas, cargar brokers, configurar MetaTrader o revisar la estrategia.</p></section>
      </>
    );
  }

  // ---------- Administrador ----------
  if (admin) {
    const cupo = Math.max(1, Number((await leerAjustes()).visitas_cupo) || 1);
    const { data: adm } = await sb.from("perfiles").select("id, nombre").eq("rol", "admin").order("nombre");
    const admins = (adm ?? []) as { id: string; nombre: string }[];
    const { data } = await sb.from("visitas").select("*").order("fecha").order("hora").limit(300);
    const todas = (data ?? []) as Visita[];
    const ids = Array.from(new Set(todas.map((v) => v.user_id)));
    const { data: ps } = await sb.from("perfiles").select("id, nombre, email, telefono").in("id", ids.concat(["00000000-0000-0000-0000-000000000000"]));
    const quien = new Map(((ps ?? []) as { id: string; nombre: string; email: string; telefono: string | null }[]).map((p) => [p.id, p]));
    const pend = todas.filter((v) => v.estado === "pendiente" && visitaVigente(v.fecha, v.hora));
    const prox = todas.filter((v) => v.estado === "aprobada" && visitaVigente(v.fecha, v.hora));
    const prop = todas.filter((v) => v.estado === "propuesta");
    const resto = todas.filter((v) => !pend.includes(v) && !prox.includes(v) && !prop.includes(v)).reverse().slice(0, 30);
    const Tarjeta = ({ v }: { v: Visita }) => {
      const p = quien.get(v.user_id);
      const lleno = todas.filter((x) => x.estado === "aprobada" && x.fecha === v.fecha && x.hora === v.hora).length;
      const wa = whatsapp(p?.telefono);
      const texto = "Hola " + (p?.nombre || "").split(" ")[0] + ", tu visita a la oficina quedó " + (v.estado === "aprobada" ? "aprobada" : "rechazada") + ": " + fechaLarga(v.fecha) + " a las " + horaCorta(v.hora) + "." + (v.estado === "aprobada" && v.encargado_nombre ? " Te va a recibir " + v.encargado_nombre + "." : "") + (v.nota ? " " + v.nota : "");
      return (
        <div className="ses" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b>{p?.nombre || p?.email || "—"}</b>
            <small className="mu" style={{ display: "block" }}>{p?.email}{p?.telefono ? " · " + p.telefono : ""}</small>
            <small style={{ display: "block" }}><b>{cap(fechaLarga(v.fecha))} · {horaCorta(v.hora)}</b> · {v.tema}</small>
            {v.estado === "pendiente" && lleno >= cupo && <small style={{ display: "block", color: "var(--co)" }}>Ese horario ya está ocupado por otra visita aprobada.</small>}
            {v.estado === "propuesta" && v.propuesta_fecha && <small style={{ display: "block" }}>Propuesto: <b>{cap(fechaLarga(v.propuesta_fecha))} · {horaCorta(v.propuesta_hora ?? "")}</b> · recibe: <b>{v.encargado_nombre}</b> · esperando que la persona acepte</small>}
            {v.estado === "aprobada" && <small style={{ display: "block" }}>Recibe: <b>{v.encargado_nombre || "sin asignar"}</b></small>}
            {v.detalle && <small className="mu" style={{ display: "block", whiteSpace: "pre-wrap" }}>{v.detalle}</small>}
            {v.estado !== "pendiente" && <small className="mu" style={{ display: "block" }}>{ETIQ[v.estado]}{v.nota ? " · " + v.nota : ""}</small>}
          </div>
          {(v.estado === "pendiente" || v.estado === "aprobada" || v.estado === "propuesta") && (
            <form action={revisarVisita} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input type="hidden" name="id" value={v.id} />
              <input name="nota" placeholder="Nota para la persona (opcional)" maxLength={200} style={{ width: 200 }} defaultValue={v.nota} />
              {v.estado === "pendiente" && lleno < cupo && (
                <>
                  <select name="encargado" defaultValue="" style={{ width: 190 }} aria-label="Quién recibe a la persona">
                    <option value="" disabled>Quién la recibe…</option>
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  <button className="btn s" name="decision" value="aprobar">Aprobar</button>
                </>
              )}
              <button className="btn g s" name="decision" value="rechazar">{v.estado === "aprobada" ? "Anular" : v.estado === "propuesta" ? "Retirar propuesta" : "Rechazar"}</button>
              {v.estado === "aprobada" && wa && <a className="btn sd s" href={"https://wa.me/" + wa + "?text=" + encodeURIComponent(texto)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            </form>
          )}
          {v.estado === "pendiente" && (
            <details style={{ flexBasis: "100%" }}>
              <summary className="mu" style={{ cursor: "pointer" }}>Proponer otro horario…</summary>
              <form action={proponerHorario} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <input type="hidden" name="id" value={v.id} />
                <select name="fecha" defaultValue={v.fecha} aria-label="Nuevo día" required>
                  {proximosMiercoles(hoy).map((f) => <option key={f} value={f}>{cap(fechaLarga(f))}</option>)}
                </select>
                <select name="hora" defaultValue="" aria-label="Nuevo horario" required>
                  <option value="" disabled>Nuevo horario…</option>
                  {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select name="encargado" defaultValue="" aria-label="Quién la recibe" required>
                  <option value="" disabled>Quién la recibe…</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <input name="nota" placeholder="Mensaje para la persona (opcional)" maxLength={200} style={{ width: 220 }} />
                <button className="btn s">Enviar propuesta</button>
              </form>
              <small className="mu">Si el horario ya está ocupado por una visita aprobada, no se podrá proponer. La persona debe aceptarlo para que quede aprobada.</small>
            </details>
          )}
        </div>
      );
    };
    return (
      <>
        <h1>Visitas a la oficina</h1>
        <p className="sub">Solicitudes de los miembros VIP. Solo miércoles de 8:00 a 17:00, una sola persona por horario. Al aprobar debes elegir quién la recibe. Una vez aprobada, el horario se bloquea para los demás. Al aprobar o rechazar, la persona recibe el aviso en sus notificaciones.</p>
        {msgs}
        <section className="box">
          <h2>Por aprobar ({pend.length})</h2>
          {pend.length === 0 ? <p className="mu">No hay solicitudes pendientes.</p> : pend.map((v) => <Tarjeta key={v.id} v={v} />)}
        </section>
        {prop.length > 0 && (
          <section className="box">
            <h2>Esperando respuesta de la persona ({prop.length})</h2>
            {prop.map((v) => <Tarjeta key={v.id} v={v} />)}
          </section>
        )}
        <section className="box">
          <h2>Próximas visitas aprobadas ({prox.length})</h2>
          {prox.length === 0 ? <p className="mu">Todavía no hay visitas aprobadas.</p> : prox.map((v) => <Tarjeta key={v.id} v={v} />)}
        </section>
        {resto.length > 0 && (
          <section className="box">
            <h2>Historial</h2>
            {resto.map((v) => <Tarjeta key={v.id} v={v} />)}
          </section>
        )}
      </>
    );
  }

  // ---------- Miembro VIP ----------
  const [rMis, rOc] = await Promise.all([
    sb.from("visitas").select("*").eq("user_id", perfil.id).order("fecha", { ascending: false }).limit(20),
    sb.rpc("visitas_ocupadas"),
  ]);
  const faltaMigracion = !!rMis.error;
  const mis = (rMis.data ?? []) as Visita[];
  const activa = mis.find((v) => (v.estado === "pendiente" || v.estado === "aprobada" || v.estado === "propuesta") && visitaVigente(v.fecha, v.hora));
  // Resultado de la última solicitud revisada: se muestra arriba, bien visible (aprobada o rechazada).
  const ultima = mis.find((v) => v.estado === "rechazada" && v.revisado_at && Date.now() - new Date(v.revisado_at).getTime() < 14 * 86400000);
  const rechazadaReciente = !activa && ultima && mis[0]?.id === ultima.id ? ultima : undefined;
  const ocupadas = ((rOc.data ?? []) as { fecha: string; hora: string }[]).map((o) => o.fecha + " " + horaCorta(o.hora));
  const fechas = proximosMiercoles(hoy).map((f) => ({ v: f, t: cap(fechaLarga(f)) }));
  return (
    <>
      <h1>Agendar visita</h1>
      <p className="sub">Visita nuestras oficinas para resolver tus dudas, cargar brokers, configurar MetaTrader o revisar cualquier pregunta sobre la estrategia. Atendemos solo los <b>miércoles de 8:00 a 17:00</b> y cada visita se confirma manualmente.</p>
      {msgs}
      {activa?.estado === "aprobada" && <section className="box" style={{ borderColor: "var(--go)" }}><div className="tag" style={{ marginTop: 0 }}>✓ Tu solicitud fue aprobada</div><p style={{ margin: "6px 0 0" }}><b>{cap(fechaLarga(activa.fecha))} · {horaCorta(activa.hora)}</b>. Te esperamos en la oficina.{activa.encargado_nombre ? " Te recibe " + activa.encargado_nombre + "." : ""}{activa.nota ? " " + activa.nota : ""}</p></section>}
      {activa?.estado === "propuesta" && activa.propuesta_fecha && (
        <section className="box" style={{ borderColor: "var(--go)" }}>
          <div className="tag" style={{ marginTop: 0 }}>Te propusieron otro horario</div>
          <p style={{ margin: "6px 0 0" }}>No podemos atenderte el <b>{fechaLarga(activa.fecha)} a las {horaCorta(activa.hora)}</b>. Te proponemos: <b>{cap(fechaLarga(activa.propuesta_fecha))} · {horaCorta(activa.propuesta_hora ?? "")}</b>{activa.encargado_nombre ? ", te recibe " + activa.encargado_nombre : ""}.{activa.nota ? " " + activa.nota : ""}</p>
          <form action={responderPropuesta} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={activa.id} />
            <button className="btn s" name="decision" value="aceptar">Aceptar nuevo horario</button>
            <button className="btn g s" name="decision" value="rechazar">No me sirve</button>
          </form>
        </section>
      )}
      {rechazadaReciente && <section className="box" style={{ borderColor: "var(--co)" }}><div className="tag" style={{ marginTop: 0, color: "var(--co)" }}>✕ Tu solicitud no pudo aprobarse</div><p style={{ margin: "6px 0 0" }}><b>{cap(fechaLarga(rechazadaReciente.fecha))} · {horaCorta(rechazadaReciente.hora)}</b>.{rechazadaReciente.nota ? " " + rechazadaReciente.nota : " Puedes elegir otro horario abajo."}</p></section>}
      {faltaMigracion ? (
        <section className="box"><p className="mu">Esta función todavía no está disponible.</p></section>
      ) : activa ? (
        <section className="box">
          <div className="tag">{ETIQ[activa.estado]}</div>
          <h2>{cap(fechaLarga(activa.fecha))} · {horaCorta(activa.hora)}</h2>
          <p className="mu">Tema: {activa.tema}{activa.detalle ? " — " + activa.detalle : ""}</p>
          {activa.estado === "propuesta" && <p className="mu">Tienes una propuesta de nuevo horario arriba: acéptala o recházala.</p>}
          {activa.estado === "pendiente" && <p className="mu">Estamos revisando tu solicitud. Apenas la aprobemos (o no), lo verás aquí arriba y en el menú “Agendar visita”.</p>}
          <form action={cancelarVisita}><input type="hidden" name="id" value={activa.id} /><button className="btn g s">Cancelar esta visita</button></form>
        </section>
      ) : (
        <section className="box">
          <h2>Elige tu horario</h2>
          <FormVisita action={agendarVisita} fechas={fechas} horas={HORAS} temas={TEMAS} ocupadas={ocupadas} />
        </section>
      )}
      {mis.filter((v) => v !== activa).length > 0 && (
        <section className="box">
          <h2>Tus visitas anteriores</h2>
          {mis.filter((v) => v !== activa).map((v) => (
            <div key={v.id} className="ses"><div><b>{cap(fechaLarga(v.fecha))} · {horaCorta(v.hora)}</b><small className="mu" style={{ display: "block" }}>{v.tema} · {ETIQ[v.estado]}{v.nota ? " · " + v.nota : ""}</small></div></div>
          ))}
        </section>
      )}
    </>
  );
}
