import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual, permisos } from "@/lib/sesion";
import SalaChat, { type MsgSala, type ReaccionSala } from "@/components/SalaChat";
import { SALA_DESDE, SALA_HASTA, SALA_HORAS_HISTORIAL } from "@/lib/sala";
import { desbloquearEnSala } from "./actions";

export const dynamic = "force-dynamic";

export default async function Sala() {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad && !perm.admin) {
    return (
      <>
        <Link href="/comunidad" className="back">← Comunidad</Link>
        <h1>Sala de trading en vivo</h1>
        <section className="box"><div className="tag">Solo miembros VIP</div><p className="mu">La sala de trading es un chat en vivo para los miembros VIP: comparte tus gráficos y opera acompañado.</p><Link className="btn sd" href="/ayuda">Quiero ser VIP</Link></section>
      </>
    );
  }
  const sb = createClient();

  // El historial dura 24 horas: lo más viejo se borra (con sus imágenes) cada vez que alguien abre la sala.
  const adm = clienteAdmin();
  if (adm) {
    const corte = new Date(Date.now() - SALA_HORAS_HISTORIAL * 3600000).toISOString();
    const { data: viejos } = await adm.from("sala_mensajes").select("id, imagen_path").lt("created_at", corte).limit(300);
    const lista = (viejos ?? []) as { id: string; imagen_path: string | null }[];
    if (lista.length) {
      const rutas = lista.map((x) => x.imagen_path).filter(Boolean) as string[];
      if (rutas.length) await adm.storage.from("sala").remove(rutas);
      await adm.from("sala_mensajes").delete().in("id", lista.map((x) => x.id));
    }
  }

  const r = await sb.from("sala_mensajes").select("*").order("created_at", { ascending: false }).limit(200);
  const faltaMigracion = !!r.error;
  const inicial = ((r.data ?? []) as MsgSala[]).reverse();
  // Reacciones (si aún no se corrió la migración 0061, simplemente no hay).
  const rr = await sb.from("sala_reacciones").select("mensaje_id, user_id, emoji").limit(3000);
  const reacciones = (rr.error ? [] : rr.data ?? []) as ReaccionSala[];
  const { data: bl } = await sb.from("sala_bloqueos").select("user_id, hasta").or("hasta.is.null,hasta.gt." + new Date().toISOString());
  const bloqueos = (bl ?? []) as { user_id: string; hasta: string | null }[];
  const bloqueado = bloqueos.some((b) => b.user_id === perfil.id) && !perm.admin;
  let nombres = new Map<string, string>();
  if (perm.admin && bloqueos.length) {
    const { data: ps } = await sb.from("perfiles").select("id, nombre, email").in("id", bloqueos.map((b) => b.user_id));
    nombres = new Map(((ps ?? []) as { id: string; nombre: string | null; email: string }[]).map((p) => [p.id, p.nombre || p.email]));
  }

  return (
    <>
      <Link href="/comunidad" className="back">← Comunidad</Link>
      <h1>Sala de trading en vivo</h1>
      <p className="sub">Chat en tiempo real para los miembros VIP: escribe, comparte tus gráficos y mira lo que opera la comunidad. Abre todos los días de {SALA_DESDE} a {SALA_HASTA} (hora de Paraguay) y los mensajes se borran a las {SALA_HORAS_HISTORIAL} horas. Contenido educativo, no es recomendación de inversión.</p>
      {faltaMigracion
        ? <section className="box"><p className="mu">La sala todavía no está activada.</p></section>
        : <SalaChat yo={perfil.id} esAdmin={perm.admin} inicial={inicial} reaccionesIni={reacciones} bloqueado={bloqueado} />}
      {perm.admin && bloqueos.length > 0 && (
        <section className="box">
          <h2>Personas bloqueadas ({bloqueos.length})</h2>
          {bloqueos.map((b) => (
            <div key={b.user_id} className="ses">
              <div style={{ flex: 1 }}><b>{nombres.get(b.user_id) ?? b.user_id}</b><small className="mu" style={{ display: "block" }}>{b.hasta ? "Hasta " + new Date(b.hasta).toLocaleString("es-PY", { timeZone: "America/Asuncion" }) : "Permanente"}</small></div>
              <form action={desbloquearEnSala}><input type="hidden" name="user" value={b.user_id} /><button className="btn g s">Desbloquear</button></form>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
