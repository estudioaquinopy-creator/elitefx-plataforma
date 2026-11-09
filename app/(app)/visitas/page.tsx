import { createClient } from "@/lib/supabase/server";
import { perfilActual, hoyPY, vipVigente } from "@/lib/sesion";
import { HORAS, TEMAS, proximosMiercoles, visitaVigente, fechaLarga, horaCorta, whatsapp } from "@/lib/visitas";
import { agendarVisita, cancelarVisita, revisarVisita } from "./actions";
import { leerAjustes } from "@/lib/ajustes";
import FormVisita from "@/components/FormVisita";

export const dynamic = "force-dynamic";

type Visita = { id: string; user_id: string; fecha: string; hora: string; tema: string; detalle: string; estado: string; nota: string; created_at: string; revisado_at?: string | null };
const ETIQ: Record<string, string> = { pendiente: "Pendiente de aprobación", aprobada: "Aprobada", rechazada: "Rechazada", cancelada: "Cancelada" };
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
    const cupo = Math.max(1, Number((await leerAjustes()).visitas_cupo) || 3);
    const { data } = await sb.from("visitas").select("*").order("fecha").order("hora").limit(300);
    const todas = (data ?? []) as Visita[];
    const ids = Array.from(new Set(todas.map((v) => v.user_id)));
    const { data: ps } = await sb.from("perfiles").select("id, nombre, email, telefono").in("id", ids.concat(["00000000-0000-0000-0000-000000000000"]));
    const quien = new Map(((ps ?? []) as { id: string; nombre: string; email: string; telefono: string | null }[]).map((p) => [p.id, p]));
    const pend = todas.filter((v) => v.estado === "pendiente" && visitaVigente(v.fecha, v.hora));
    const prox = todas.filter((v) => v.estado === "aprobada" && visitaVigente(v.fecha, v.hora));
    const resto = todas.filter((v) => !pend.includes(v) && !prox.includes(v)).reverse().slice(0, 30);
    const Tarjeta = ({ v }: { v: Visita }) => {
      const p = quien.get(v.user_id);
      const lleno = todas.filter((x) => x.estado === "aprobada" && x.fecha === v.fecha && x.hora === v.hora).length;
      const wa = whatsapp(p?.telefono);
      const texto = "Hola " + (p?.nombre || "").split(" ")[0] + ", tu visita a la oficina quedó " + (v.estado === "aprobada" ? "aprobada" : "rechazada") + ": " + fechaLarga(v.fecha) + " a las " + horaCorta(v.hora) + "." + (v.nota ? " " + v.nota : "");
      return (
        <div className="ses" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b>{p?.nombre || p?.email || "—"}</b>
            <small className="mu" style={{ display: "block" }}>{p?.email}{p?.telefono ? " · " + p.telefono : ""}</small>
            <small style={{ display: "block" }}><b>{cap(fechaLarga(v.fecha))} · {horaCorta(v.hora)}</b> · {v.tema}</small>
            {v.estado === "pendiente" && <small className="mu" style={{ display: "block" }}>Cupo en ese horario: {lleno} de {cupo} aprobadas</small>}
            {v.detalle && <small className="mu" style={{ display: "block", whiteSpace: "pre-wrap" }}>{v.detalle}</small>}
            {v.estado !== "pendiente" && <small className="mu" style={{ display: "block" }}>{ETIQ[v.estado]}{v.nota ? " · " + v.nota : ""}</small>}
          </div>
          {(v.estado === "pendiente" || v.estado === "aprobada") && (
            <form action={revisarVisita} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input type="hidden" name="id" value={v.id} />
              <input name="nota" placeholder="Nota para la persona (opcional)" maxLength={200} style={{ width: 200 }} defaultValue={v.nota} />
              {v.estado === "pendiente" && lleno < cupo && <button className="btn s" name="decision" value="aprobar">Aprobar</button>}
              <button className="btn g s" name="decision" value="rechazar">{v.estado === "aprobada" ? "Anular" : "Rechazar"}</button>
              {v.estado === "aprobada" && wa && <a className="btn sd s" href={"https://wa.me/" + wa + "?text=" + encodeURIComponent(texto)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            </form>
          )}
        </div>
      );
    };
    return (
      <>
        <h1>Visitas a la oficina</h1>
        <p className="sub">Solicitudes de los miembros VIP. Solo miércoles de 8:00 a 17:00, hasta {cupo} personas por horario. Al aprobar o rechazar, la persona recibe el aviso en sus notificaciones.</p>
        {msgs}
        <section className="box">
          <h2>Por aprobar ({pend.length})</h2>
          {pend.length === 0 ? <p className="mu">No hay solicitudes pendientes.</p> : pend.map((v) => <Tarjeta key={v.id} v={v} />)}
        </section>
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
  const activa = mis.find((v) => (v.estado === "pendiente" || v.estado === "aprobada") && visitaVigente(v.fecha, v.hora));
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
      {activa?.estado === "aprobada" && <section className="box" style={{ borderColor: "var(--go)" }}><div className="tag" style={{ marginTop: 0 }}>✓ Tu solicitud fue aprobada</div><p style={{ margin: "6px 0 0" }}><b>{cap(fechaLarga(activa.fecha))} · {horaCorta(activa.hora)}</b>. Te esperamos en la oficina.{activa.nota ? " " + activa.nota : ""}</p></section>}
      {rechazadaReciente && <section className="box" style={{ borderColor: "var(--co)" }}><div className="tag" style={{ marginTop: 0, color: "var(--co)" }}>✕ Tu solicitud no pudo aprobarse</div><p style={{ margin: "6px 0 0" }}><b>{cap(fechaLarga(rechazadaReciente.fecha))} · {horaCorta(rechazadaReciente.hora)}</b>.{rechazadaReciente.nota ? " " + rechazadaReciente.nota : " Puedes elegir otro horario abajo."}</p></section>}
      {faltaMigracion ? (
        <section className="box"><p className="mu">Esta función todavía no está disponible.</p></section>
      ) : activa ? (
        <section className="box">
          <div className="tag">{ETIQ[activa.estado]}</div>
          <h2>{cap(fechaLarga(activa.fecha))} · {horaCorta(activa.hora)}</h2>
          <p className="mu">Tema: {activa.tema}{activa.detalle ? " — " + activa.detalle : ""}</p>
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
