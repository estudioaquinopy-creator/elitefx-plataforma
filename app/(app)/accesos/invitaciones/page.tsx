import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { enlacePrueba } from "@/lib/referidos";
import CopiarEnlace from "@/components/CopiarEnlace";
import { crearInvitacionPrueba, cerrarInvitacionPrueba } from "./actions";

export const dynamic = "force-dynamic";

type Inv = { id: string; codigo: string; dias: number; cupo: number; expira_at: string; activa: boolean; nota: string; created_at: string };
const cuando = (d: string) => new Date(d).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function Invitaciones({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") notFound();
  const sb = createClient();
  const { data, error } = await sb.from("invitaciones_prueba").select("*").order("created_at", { ascending: false }).limit(50);
  const { data: canjes } = await sb.from("pruebas_canjeadas").select("invitacion_id");
  const usados = new Map<string, number>();
  for (const c of (canjes ?? []) as { invitacion_id: string }[]) usados.set(c.invitacion_id, (usados.get(c.invitacion_id) ?? 0) + 1);
  const lista = (data ?? []) as Inv[];
  const ahora = Date.now();
  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>Invitaciones de prueba VIP</h1>
      <p className="sub">Crea un enlace que dura pocas horas: las personas <b>nuevas</b> que se registren con él reciben VIP por unos días y después vuelven a gratuito solas. Durante la prueba tienen cursos, calendario, comunidad, journal y noticias; no participan en el ranking ni agendan visitas.</p>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {error && <p className="alerta">Falta correr la migración 0039 en Supabase.</p>}
      <section className="box">
        <h2>Nueva invitación</h2>
        <form action={crearInvitacionPrueba} className="fm">
          <label>Días de VIP<input name="dias" type="number" min={1} max={30} defaultValue={5} required /></label>
          <label>Horas que dura el enlace<input name="horas" type="number" min={1} max={168} defaultValue={24} required /></label>
          <label>Tope de personas<input name="cupo" type="number" min={1} max={1000} defaultValue={100} required /></label>
          <label>Nota (opcional, solo para ti)<input name="nota" maxLength={120} placeholder="Ej.: reto de noviembre" /></label>
          <button className="btn">Crear enlace</button>
        </form>
      </section>
      <section className="box">
        <h2>Tus invitaciones</h2>
        {lista.length === 0 && <p className="mu">Todavía no creaste ninguna.</p>}
        {lista.map((i) => {
          const n = usados.get(i.id) ?? 0;
          const vencida = new Date(i.expira_at).getTime() <= ahora;
          const estado = !i.activa ? "Desactivada" : vencida ? "Venció" : n >= i.cupo ? "Cupo completo" : "Activa";
          const enlace = enlacePrueba(i.codigo);
          return (
            <div key={i.id} className="ses" style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <b>{estado}</b> · {n} de {i.cupo} personas · {i.dias} días de VIP
                <small className="mu" style={{ display: "block" }}>Creada {cuando(i.created_at)} · vence {cuando(i.expira_at)}{i.nota ? " · " + i.nota : ""}</small>
                <small style={{ display: "block", wordBreak: "break-all" }}>{enlace}</small>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {estado === "Activa" && <CopiarEnlace texto={enlace} />}
                {i.activa && !vencida && (
                  <form action={cerrarInvitacionPrueba}><input type="hidden" name="id" value={i.id} /><button className="btn g s">Desactivar</button></form>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
