import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Fila = { id: string; created_at: string; admin_email: string | null; accion: string; objetivo: string | null; detalle: string };

export default async function Registro() {
  const p = await perfilActual();
  if (p.rol !== "admin") notFound();
  const sb = createClient();
  const { data, error } = await sb.from("auditoria").select("*").order("created_at", { ascending: false }).limit(200);
  const filas = (data ?? []) as Fila[];
  // Nombres de las personas afectadas (si todavía existen).
  const ids = Array.from(new Set(filas.map((f) => f.objetivo).filter(Boolean) as string[]));
  const { data: ps } = ids.length ? await sb.from("perfiles").select("id, nombre, email").in("id", ids) : { data: [] };
  const quien = new Map((ps ?? []).map((x: { id: string; nombre: string; email: string }) => [x.id, x.nombre || x.email]));
  const fecha = (t: string) => new Date(t).toLocaleString("es-PY", { timeZone: "America/Asuncion", dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>Registro de acciones</h1>
      <p className="sub">Las últimas 200 acciones de los administradores: quién hizo qué y cuándo.</p>
      {error && <p className="alerta">Todavía no está activo: corre la migración 0021_seguridad.sql en Supabase.</p>}
      <section className="box">
        {filas.length === 0 && !error && <p className="mu">Aún no hay acciones registradas.</p>}
        {filas.map((f) => (
          <div key={f.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
            <b>{f.accion}</b>{f.objetivo && <span> · {quien.get(f.objetivo) ?? "persona eliminada"}</span>}
            <small className="mu" style={{ display: "block", overflowWrap: "anywhere" }}>{fecha(f.created_at)} · {f.admin_email ?? "—"}{f.detalle ? " · " + f.detalle : ""}</small>
          </div>
        ))}
      </section>
    </>
  );
}
