import Link from "next/link";
import { tieneAyuda, recibeAyuda } from "@/lib/ayuda";
import { redirect } from "next/navigation";
import EnLinea from "@/components/EnLinea";
import ProgresoNav from "@/components/ProgresoNav";
import Shell from "@/components/Shell";
import InactividadAuto from "@/components/InactividadAuto";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos, vipVigente } from "@/lib/sesion";
import { modoAlumno } from "./actions";
import { ocurrencias, type Fijo } from "@/lib/horario";
import { hoyPY } from "@/lib/sesion";
import { visitaVigente } from "@/lib/visitas";
import { leerAjustes } from "@/lib/ajustes";
import { armarRedes } from "@/lib/redes";
import { referidosActivos, fechaReferidos } from "@/lib/referidos";
import { TERMINOS_VERSION } from "@/lib/terminos";
import type { Notif } from "@/components/Cabecera";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  // Términos y condiciones: quien no aceptó la versión vigente debe aceptarlos (si aún no se corrió la migración 0052, la columna no existe y no se pide).
  if (perfil.terminos_version !== undefined && perfil.terminos_version !== TERMINOS_VERSION) redirect("/aceptar-terminos");
  // La foto de perfil es obligatoria (excepto para administradores y su modo alumno).
  if (perfil.rol !== "admin" && !perfil.vista && !perfil.avatar_url) redirect("/foto");
  const items: { href: string; label: string; lock: boolean; icon: string; soon?: string; aviso?: { texto: string; tipo: "ok" | "no" } }[] = [
    { href: "/inicio", label: "Inicio", lock: false, icon: "M3 11l9-8 9 8M5 10v10h14V10" },
    { href: "/cursos", label: "Cursos", lock: false, icon: "M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-3a3 3 0 0 0-3 3" },
    { href: "/calendario", label: "Calendario", lock: !perm.calendario, icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13H3zM3 11h18M8 3v4M16 3v4" },
    { href: "/aliados", label: "Broker", lock: false, icon: "M3 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M11 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0" },
    { href: "/comunidad", label: "Comunidad", lock: !perm.comunidad, icon: "M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z" },
    { href: "/journal", label: "Journal", lock: !perm.journal, icon: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM9 4v16M12 9h4M12 13h4" },
    { href: "/noticias", label: "Noticias", lock: !perm.noticias, icon: "M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM18 8h2v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4" },
  ];
  if (perfil.rol === "admin") {
    items.push({ href: "/accesos", label: "Accesos", lock: false, icon: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" });
  }

  // Todas las consultas del menú en paralelo (antes iban una detrás de otra).
  const supabase = createClient();
  const ahora = Date.now();
  const limite = new Date(); limite.setDate(limite.getDate() + 7);
  const hace14 = new Date(ahora - 14 * 86400000).toISOString();
  const hace7 = new Date(ahora - 7 * 86400000).toISOString();
  const [rNot, rVen, rFx, rCl, aj, rVisMias, rVisPend] = await Promise.all([
    supabase.from("notificaciones").select("*").or("user_id.is.null,user_id.eq." + perfil.id).order("created_at", { ascending: false }).limit(15),
    perfil.rol === "admin"
      ? supabase.from("perfiles").select("id, nombre, email, vence").not("vence", "is", null).gte("vence", new Date(ahora - 30 * 86400000).toISOString().slice(0, 10)).lte("vence", limite.toISOString().slice(0, 10)).order("vence").limit(500)
      : Promise.resolve({ data: null }),
    perm.calendario ? supabase.from("horario_fijo").select("*") : Promise.resolve({ data: null }),
    perm.calendario
      ? supabase.from("clases").select("id, titulo, inicio, zoom_url").gte("inicio", new Date(ahora).toISOString()).lte("inicio", new Date(ahora + 61 * 60000).toISOString())
      : Promise.resolve({ data: null }),
    leerAjustes(),
    // Avisos de visitas: a la persona, cuando se aprueba o rechaza su solicitud; al admin, cuántas hay por aprobar.
    perfil.rol !== "admin"
      ? supabase.from("visitas").select("id, fecha, hora, estado, revisado_at").eq("user_id", perfil.id).in("estado", ["aprobada", "rechazada"]).gte("revisado_at", hace14).order("revisado_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    perfil.rol === "admin"
      ? supabase.from("visitas").select("id", { count: "exact", head: true }).eq("estado", "pendiente").gte("fecha", hoyPY())
      : Promise.resolve({ count: 0 }),
  ]);
  // Si aún no se corrió la migración 0050 (columna user_id), se pide la lista general como antes.
  if (rNot.error) {
    const r2 = await supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(15);
    (rNot as { data: unknown }).data = r2.data;
  }
  // Administrador: preguntas de lecciones sin responder (últimos 7 días).
  let dudasSin = 0;
  let dudasLista: Notif[] = [];
  let leccionesSin: Set<string> | null = null; // lecciones con alguna pregunta sin responder (solo se calcula para el administrador)
  if (perfil.rol === "admin" && !perfil.vista) {
    const [rq, rr] = await Promise.all([
      supabase.from("lecciones_comentarios").select("id, curso_id, leccion_id, autor, cuerpo, created_at").is("parent_id", null).gte("created_at", hace7).order("created_at", { ascending: false }).limit(100),
      supabase.from("lecciones_comentarios").select("parent_id").not("parent_id", "is", null).gte("created_at", hace7).limit(300),
    ]);
    if (!rq.error && !rr.error) {
      const resp = new Set((rr.data ?? []).map((x: { parent_id: string }) => x.parent_id));
      const sin = (rq.data ?? []).filter((x: { id: string }) => !resp.has(x.id)) as { id: string; curso_id: string; leccion_id: string; autor: string; cuerpo: string; created_at: string }[];
      dudasSin = sin.length;
      leccionesSin = new Set(sin.map((x) => x.leccion_id));
      // Una entrada por pregunta (las 5 más recientes), cada una lleva directo a esa pregunta.
      dudasLista = sin.slice(0, 5).map((x) => ({ id: "duda-" + x.id, titulo: "Pregunta sin responder: " + (x.autor || "alumno"), cuerpo: x.cuerpo.length > 80 ? x.cuerpo.slice(0, 80) + "…" : x.cuerpo, enlace: "/cursos/" + x.curso_id + "?l=" + x.leccion_id + "#d-" + x.id, fecha: "", nueva: true }));
    }
  }
  const vistas = perfil.notif_leidas_at ? new Date(perfil.notif_leidas_at).getTime() : 0;
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-PY");
  const notifs: Notif[] = ((rNot.data ?? []) as { id: string; titulo: string; cuerpo: string; enlace: string | null; created_at: string }[]).map((n) => ({
    id: n.id,
    titulo: n.titulo,
    cuerpo: n.cuerpo,
    enlace: n.enlace || "/inicio",
    fecha: fmt(n.created_at),
    nueva: new Date(n.created_at).getTime() > vistas,
  }));
  // Administrador: el aviso "te mencionó en «lección»" ya no se muestra cuando la pregunta de esa lección fue respondida.
  if (leccionesSin) {
    for (let i = notifs.length - 1; i >= 0; i--) {
      const m = /\?l=([^#&]+)#dudas/.exec(notifs[i].enlace ?? "");
      if (m && notifs[i].titulo.includes("te mencionó en") && !leccionesSin.has(m[1])) notifs.splice(i, 1);
    }
  }
  const hoyIso = new Date().toISOString().slice(0, 10);
  // Membresías: una sola notificación con el número de vencidas (últimos 30 días) y otra con las que vencen en 7 días; al tocarlas abren la lista en Accesos.
  const venc = ((rVen.data ?? []) as { vence: string }[]);
  const nVencidas = venc.filter((a) => a.vence < hoyIso).length;
  const nPorVencer = venc.length - nVencidas;
  if (nPorVencer > 0) notifs.unshift({ id: "v-por", titulo: nPorVencer + (nPorVencer === 1 ? " membresía por vencer" : " membresías por vencer"), cuerpo: "Vencen en los próximos 7 días · toca para ver la lista", enlace: "/accesos?e=porvencer", fecha: "", nueva: true });
  if (nVencidas > 0) notifs.unshift({ id: "v-venc", titulo: nVencidas + (nVencidas === 1 ? " membresía vencida" : " membresías vencidas"), cuerpo: "Vencidas en los últimos 30 días · toca para ver la lista", enlace: "/accesos?e=vencido", fecha: "", nueva: true });
  for (const v of (rVisMias.data ?? []) as { id: string; fecha: string; hora: string; estado: string; revisado_at: string }[]) {
    const dia = new Date(v.fecha + "T12:00:00Z").toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
    notifs.unshift({
      id: "vis-" + v.id,
      titulo: v.estado === "aprobada" ? "Tu visita fue aprobada" : "Tu visita no pudo aprobarse",
      cuerpo: dia + " a las " + String(v.hora).slice(0, 5),
      enlace: "/visitas",
      fecha: fmt(v.revisado_at),
      nueva: new Date(v.revisado_at).getTime() > vistas,
    });
  }
  // Alerta fija (no la campana) para los administradores elegidos: preguntas con #ayuda o @ayuda (últimos 7 días) que ningún administrador respondió.
  let pedidosAyuda: { id: string; autor: string; texto: string }[] = [];
  if (perfil.rol === "admin" && !perfil.vista && recibeAyuda(aj.ayuda_admins, perfil.id)) {
    const { data: pa } = await supabase.from("publicaciones").select("id, autor, titulo, cuerpo, created_at").eq("canal", "preguntas")
      .gte("created_at", new Date(ahora - 7 * 86400000).toISOString())
      .or("titulo.ilike.%ayuda%,cuerpo.ilike.%ayuda%").order("created_at", { ascending: false }).limit(20);
    const pedidos = ((pa ?? []) as { id: string; autor: string; titulo: string; cuerpo: string }[]).filter((x) => tieneAyuda(x.titulo, x.cuerpo));
    if (pedidos.length) {
      const [{ data: cmA }, { data: admsA }] = await Promise.all([
        supabase.from("comentarios").select("post_id, user_id").in("post_id", pedidos.map((x) => x.id)),
        supabase.from("perfiles").select("id").eq("rol", "admin"),
      ]);
      const ids = new Set(((admsA ?? []) as { id: string }[]).map((x) => x.id));
      const resp = new Set(((cmA ?? []) as { post_id: string; user_id: string }[]).filter((x) => ids.has(x.user_id)).map((x) => x.post_id));
      pedidosAyuda = pedidos.filter((x) => !resp.has(x.id)).map((x) => ({ id: x.id, autor: x.autor || "Alguien", texto: (x.titulo || x.cuerpo).replace(/\s+/g, " ").slice(0, 80) }));
    }
  }
  if (perfil.rol === "admin" && (rVisPend.count ?? 0) > 0) {
    notifs.unshift({ id: "vis-pend", titulo: (rVisPend.count ?? 0) + (rVisPend.count === 1 ? " visita por aprobar" : " visitas por aprobar"), cuerpo: "Solicitudes de miembros VIP", enlace: "/visitas", fecha: "", nueva: true });
  }
  // Recordatorio: 30 minutos antes de cada sesión en vivo (para quien tiene calendario).
  if (perm.calendario) {
    const fijos = ((rFx.data ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
    const prox = [...ocurrencias(fijos, hoyPY(), 2), ...((rCl.data ?? []) as { id: string; titulo: string; inicio: string }[])]
      .filter((o) => { const t = new Date(o.inicio).getTime() - ahora; return t >= 0 && t <= 60 * 60000; });
    for (const o of prox) {
      const min = Math.max(1, Math.round((new Date(o.inicio).getTime() - ahora) / 60000));
      notifs.unshift({ id: "r-" + o.id, titulo: "Empieza en " + min + " min", cuerpo: o.titulo, enlace: "/calendario", fecha: "", nueva: true });
    }
  }
  // Referidos: solo VIP (y el admin), desde la fecha de activación (antes, solo el admin lo ve como vista previa).
  // Antes de la fecha, el miembro VIP lo ve en el menú pero sin enlace (con la fecha en pequeño).
  if (perfil.rol === "admin" || (vipVigente(perfil) && !perfil.prueba_hasta)) {
    const pos = items.findIndex((i) => i.href === "/noticias") + 1;
    const ya = referidosActivos(hoyPY(), aj, perfil.rol === "admin");
    items.splice(pos, 0, { href: "/referidos", label: "Referidos", lock: false, soon: ya ? undefined : fechaReferidos(aj).corto, icon: "M16 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM8 12a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M14 14.5A6 6 0 0 1 22 20" });
  }
  // Agendar visita: solo VIP y administrador (después de Noticias; Referidos queda debajo).
  if ((perfil.rol === "admin" && perfil.vista !== "gratis") || (vipVigente(perfil) && !perfil.prueba_hasta)) {
    const pos = items.findIndex((i) => i.href === "/noticias") + 1; // justo después de Noticias, por encima de Referidos
    // Aviso dentro del propio menú "Agendar visita": visita aprobada (mientras falte) o rechazada (los últimos 3 días).
    let aviso: { texto: string; tipo: "ok" | "no" } | undefined;
    if (perfil.rol !== "admin") {
      const rv = await supabase.from("visitas").select("fecha, hora, estado, revisado_at").eq("user_id", perfil.id).in("estado", ["aprobada", "rechazada"]).order("revisado_at", { ascending: false }).limit(5);
      const vs = ((rv.data ?? []) as { fecha: string; hora: string; estado: string; revisado_at: string | null }[]);
      const ap = vs.find((v) => v.estado === "aprobada" && visitaVigente(v.fecha, v.hora));
      const re = vs.find((v) => v.estado === "rechazada" && v.revisado_at && Date.now() - new Date(v.revisado_at).getTime() < 3 * 86400000);
      if (ap) aviso = { texto: "Aprobada", tipo: "ok" };
      else if (re) aviso = { texto: "Rechazada", tipo: "no" };
    }
    items.splice(pos, 0, { href: "/visitas", label: perfil.rol === "admin" ? "Visitas" : "Agendar visita", lock: false, aviso, icon: "M3 21V8l9-5l9 5v13M9 21v-6h6v6M7 11h2M15 11h2" });
  }
  const redes = armarRedes(aj);
  // Administrador: contenido reportado por los miembros, sin revisar.
  if (perfil.rol === "admin" && !perfil.vista) {
    const rp = await supabase.from("reportes").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
    const nRep = rp.error ? 0 : rp.count ?? 0;
    if (nRep > 0) notifs.unshift({ id: "reportes", titulo: nRep + (nRep === 1 ? " reporte de la comunidad por revisar" : " reportes de la comunidad por revisar"), cuerpo: "Contenido marcado por los miembros · toca para revisarlo", enlace: "/comunidad/reportes", fecha: "", nueva: true });
  }
  if (dudasSin > 5) notifs.unshift({ id: "dudas-mas", titulo: "Hay " + dudasSin + " preguntas de lecciones sin responder", cuerpo: "Se muestran las 5 más recientes", enlace: dudasLista[0]?.enlace ?? "/cursos", fecha: "", nueva: true });
  notifs.unshift(...dudasLista);
  const noLeidas = notifs.filter((n) => n.nueva).length;
  const nombre = perfil.nombre || perfil.email;
  const iniciales = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");

  return (
    <Shell items={items} nombre={nombre} email={perfil.email} iniciales={iniciales} avatar={perfil.avatar_url ?? ""} notifs={notifs} noLeidas={noLeidas} real={perfil.rol === "admin" || !!perfil.vista} vista={perfil.vista ?? ""} redes={redes} editarRedes={perfil.rol === "admin"} enLinea={<EnLinea id={perfil.id} nombre={nombre} />}>
      {perfil.vista && (
        <form action={modoAlumno} className="vbar">
          <span>Estás viendo la plataforma como <b>{perfil.vista === "gratis" ? "gratuito (nuevo)" : perfil.vista === "alumno" ? "gratuito alumno" : "VIP"}</b>. Los cambios de administrador están ocultos.</span>
          <button name="como" value="">Salir del modo alumno</button>
        </form>
      )}
      {pedidosAyuda.length > 0 && (
        <div className="ayuda-bar" role="alert">
          <b>🆘 {pedidosAyuda.length === 1 ? "1 pregunta pide ayuda" : pedidosAyuda.length + " preguntas piden ayuda"}</b>
          <div className="ayuda-l">
            {pedidosAyuda.slice(0, 3).map((x) => (
              <Link key={x.id} href={"/comunidad?canal=preguntas#" + x.id}><b>{x.autor}</b>: {x.texto} · <u>Responder</u></Link>
            ))}
            {pedidosAyuda.length > 3 && <Link href="/comunidad?canal=preguntas">y {pedidosAyuda.length - 3} más…</Link>}
          </div>
        </div>
      )}
      <ProgresoNav />
      {children}
      <InactividadAuto />
    </Shell>
  );
}
