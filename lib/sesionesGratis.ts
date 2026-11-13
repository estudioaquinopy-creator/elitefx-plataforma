import { clienteAdmin } from "@/lib/supabase/admin";
import { ocurrencias, type Fijo, type Ocurrencia } from "@/lib/horario";
import { tipoSesion } from "@/lib/sesiones";
import { ZONA } from "@/lib/sesion";

// Acceso gratuito (gratuito nuevo y gratuito alumno): del calendario solo ven —y pueden entrar a— la sesión de
// Nueva York de los MIÉRCOLES. Las tablas `horario_fijo` y `clases` solo las leen los miembros (RLS), por eso se
// leen aquí con la clave de servicio, en el servidor, y se filtran ANTES de enviar nada al navegador:
// ninguna otra sesión ni su enlace de Meet sale de aquí.

const esMiercolesPY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: ZONA, weekday: "short" }) === "Wed";

export function esSesionGratis(o: { titulo: string; inicio: string }): boolean {
  return tipoSesion(o.titulo) === "ny" && esMiercolesPY(o.inicio);
}

// Sesiones gratuitas entre `desde` y `hasta` (instantes ISO). `fechaDesde` (AAAA-MM-DD, hora PY) y `dias` arman las sesiones fijas.
export async function sesionesGratis(fechaDesde: string, dias: number, desde: string, hasta: string): Promise<{ sesiones: Ocurrencia[]; terminadas: Set<string> }> {
  const sb = clienteAdmin();
  if (!sb) return { sesiones: [], terminadas: new Set() };
  const t0 = new Date(desde).getTime(), t1 = new Date(hasta).getTime();
  const [rf, rc, rt] = await Promise.all([
    sb.from("horario_fijo").select("*"),
    sb.from("clases").select("*").gte("inicio", desde).lt("inicio", hasta).order("inicio"),
    sb.from("sesiones_terminadas").select("sesion_id"),
  ]);
  const fijos = ((rf.data ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
  const sueltas = ((rc.data ?? []) as { id: string; titulo: string; inicio: string; zoom_url: string | null; duracion_min?: number | null }[])
    .map((c) => ({ id: c.id, titulo: c.titulo, inicio: c.inicio, zoom_url: c.zoom_url || "", fijo: false, duracion_min: c.duracion_min ?? 90 }));
  const sesiones = [...sueltas, ...ocurrencias(fijos, fechaDesde, dias)]
    .filter((o) => { const t = new Date(o.inicio).getTime(); return t >= t0 && t < t1; })
    .filter(esSesionGratis)
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const terminadas = new Set(rt.error ? [] : ((rt.data ?? []) as { sesion_id: string }[]).map((x) => x.sesion_id));
  return { sesiones, terminadas };
}
