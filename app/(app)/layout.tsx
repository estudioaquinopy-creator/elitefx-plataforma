import { redirect } from "next/navigation";
import EnLinea from "@/components/EnLinea";
import ProgresoNav from "@/components/ProgresoNav";
import Shell from "@/components/Shell";
import InactividadAuto from "@/components/InactividadAuto";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { modoAlumno } from "./actions";
import { ocurrencias, type Fijo } from "@/lib/horario";
import { hoyPY } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import { armarRedes } from "@/lib/redes";
import { referidosActivos, fechaReferidos } from "@/lib/referidos";
import type { Notif } from "@/components/Cabecera";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  // La foto de perfil es obligatoria (excepto para administradores y su modo alumno).
  if (perfil.rol !== "admin" && !perfil.vista && !perfil.avatar_url) redirect("/foto");
  const items: { href: string; label: string; lock: boolean; icon: string; soon?: string }[] = [
    { href: "/inicio", label: "Inicio", lock: false, icon: "M3 11l9-8 9 8M5 10v10h14V10" },
    { href: "/cursos", label: "Cursos", lock: false, icon: "M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-3a3 3 0 0 0-3 3" },
    { href: "/calendario", label: "Calendario", lock: !perm.calendario, icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13H3zM3 11h18M8 3v4M16 3v4" },
    { href: "/tutoriales", label: "Tutoriales", lock: !perm.tutoriales, icon: "M3 6h18v12H3zM10 9.5v5l4.5-2.5z" },
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
  const [rNot, rVen, rFx, rCl, aj, rVisMias, rVisPend] = await Promise.all([
    supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(15),
    perfil.rol === "admin"
      ? supabase.from("perfiles").select("id, nombre, email, vence").not("vence", "is", null).lte("vence", limite.toISOString().slice(0, 10)).order("vence").limit(5)
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
  const hoyIso = new Date().toISOString().slice(0, 10);
  for (const a of (rVen.data ?? []) as { id: string; nombre: string; email: string; vence: string }[]) {
    notifs.unshift({
      id: "v-" + a.id,
      titulo: (a.nombre || a.email) + (a.vence < hoyIso ? " · membresía vencida" : " · por vencer"),
      cuerpo: "Vence " + fmt(a.vence),
      enlace: "/accesos",
      fecha: "",
      nueva: true,
    });
  }
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
  if (perfil.rol === "admin" || perfil.plan !== "gratis") {
    const pos = items.findIndex((i) => i.href === "/noticias") + 1;
    const ya = referidosActivos(hoyPY(), aj, perfil.rol === "admin");
    items.splice(pos, 0, { href: "/referidos", label: "Referidos", lock: false, soon: ya ? undefined : fechaReferidos(aj).corto, icon: "M16 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM8 12a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M14 14.5A6 6 0 0 1 22 20" });
  }
  // Agendar visita: solo VIP y administrador (después de Noticias; Referidos queda debajo).
  if ((perfil.rol === "admin" && perfil.vista !== "gratis") || perfil.plan !== "gratis") {
    const pos = items.findIndex((i) => i.href === "/noticias") + 1; // justo después de Noticias, por encima de Referidos
    items.splice(pos, 0, { href: "/visitas", label: perfil.rol === "admin" ? "Visitas" : "Agendar visita", lock: false, icon: "M3 21V8l9-5l9 5v13M9 21v-6h6v6M7 11h2M15 11h2" });
  }
  const redes = armarRedes(aj);
  const noLeidas = notifs.filter((n) => n.nueva).length;
  const nombre = perfil.nombre || perfil.email;
  const iniciales = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");

  return (
    <Shell items={items} nombre={nombre} email={perfil.email} iniciales={iniciales} avatar={perfil.avatar_url ?? ""} notifs={notifs} noLeidas={noLeidas} real={perfil.rol === "admin" || !!perfil.vista} vista={perfil.vista ?? ""} redes={redes} editarRedes={perfil.rol === "admin"} enLinea={<EnLinea id={perfil.id} nombre={nombre} />}>
      {perfil.vista && (
        <form action={modoAlumno} className="vbar">
          <span>Estás viendo la plataforma como <b>alumno {perfil.vista === "gratis" ? "gratis" : "miembro"}</b>. Los cambios de administrador están ocultos.</span>
          <button name="como" value="">Salir del modo alumno</button>
        </form>
      )}
      <ProgresoNav />
      {children}
      <InactividadAuto />
    </Shell>
  );
}
