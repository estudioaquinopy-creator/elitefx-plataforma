import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { eliminarReportado, revisarReporte } from "../actions";

export const dynamic = "force-dynamic";

type Rep = { id: string; tipo: string; post_id: string; comentario_id: string | null; reportado_por: string; motivo: string; detalle: string | null; estado: string; created_at: string };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// Solo administradores: contenido de la comunidad reportado por los miembros.
export default async function Reportes({ searchParams }: { searchParams: { ver?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin" || perfil.vista) redirect("/comunidad");
  const sb = createClient();
  const historial = searchParams.ver === "revisados";
  const { data, error } = await sb.from("reportes").select("*").eq("estado", historial ? "revisado" : "pendiente").order("created_at", { ascending: false }).limit(200);
  if (error) {
    return (
      <>
        <p><Link href="/comunidad" className="lk">← Comunidad</Link></p>
        <h1>Reportes</h1>
        <p className="alerta">Falta correr la migración 0053 en Supabase para activar los reportes.</p>
      </>
    );
  }
  const reps = (data ?? []) as Rep[];
  // Se agrupan por contenido reportado (varias personas pueden reportar lo mismo).
  const grupos = new Map<string, Rep[]>();
  for (const r of reps) {
    const k = r.tipo + ":" + (r.comentario_id ?? r.post_id);
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  const postIds = Array.from(new Set(reps.map((r) => r.post_id)));
  const comIds = Array.from(new Set(reps.filter((r) => r.comentario_id).map((r) => r.comentario_id as string)));
  const repIds = Array.from(new Set(reps.map((r) => r.reportado_por)));
  const [{ data: ps }, { data: cs }, { data: pr }] = await Promise.all([
    postIds.length ? sb.from("publicaciones").select("id, autor, titulo, cuerpo").in("id", postIds) : Promise.resolve({ data: [] }),
    comIds.length ? sb.from("comentarios").select("id, autor, cuerpo").in("id", comIds) : Promise.resolve({ data: [] }),
    repIds.length ? sb.from("perfiles").select("id, nombre").in("id", repIds) : Promise.resolve({ data: [] }),
  ]);
  const post = new Map(((ps ?? []) as { id: string; autor: string; titulo: string; cuerpo: string }[]).map((x) => [x.id, x]));
  const com = new Map(((cs ?? []) as { id: string; autor: string; cuerpo: string }[]).map((x) => [x.id, x]));
  const nombre = new Map(((pr ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]));
  return (
    <>
      <p><Link href="/comunidad" className="lk">← Comunidad</Link></p>
      <h1>Reportes de la comunidad</h1>
      <p className="sub">Contenido que los miembros marcaron como inapropiado. Revísalo y elimínalo o márcalo como revisado.</p>
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className={historial ? "btn sd s" : "btn s"} href="/comunidad/reportes">Pendientes</Link>
        <Link className={historial ? "btn s" : "btn sd s"} href="/comunidad/reportes?ver=revisados">Revisados</Link>
      </p>
      {grupos.size === 0 && <section className="box"><p className="mu">{historial ? "Todavía no hay reportes revisados." : "No hay reportes pendientes. 🎉"}</p></section>}
      {Array.from(grupos.entries()).map(([k, rs]) => {
        const r0 = rs[0];
        const esCom = r0.tipo === "comentario";
        const c = esCom ? com.get(r0.comentario_id as string) : null;
        const p = post.get(r0.post_id);
        const existe = esCom ? !!c : !!p;
        const ids = rs.map((x) => x.id).join(",");
        return (
          <section key={k} className="box">
            <div className="tag">{esCom ? "Respuesta reportada" : "Publicación reportada"} · {rs.length} {rs.length === 1 ? "reporte" : "reportes"}</div>
            {existe ? (
              <>
                <p style={{ margin: "6px 0 0" }}><b>{esCom ? c?.autor : p?.autor}</b></p>
                {!esCom && p?.titulo && <p style={{ margin: "2px 0 0" }}><b>{p.titulo}</b></p>}
                <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 8px" }}>{(esCom ? c?.cuerpo : p?.cuerpo) || "(sin texto)"}</p>
              </>
            ) : <p className="mu">Este contenido ya fue eliminado.</p>}
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              {rs.map((x) => <li key={x.id}><b>{x.motivo}</b> · {nombre.get(x.reportado_por) || "Miembro"} · <small className="mu">{cuando(x.created_at)}</small>{x.detalle ? <><br /><small>{x.detalle}</small></> : null}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {existe && <Link className="btn sd s" href={"/comunidad#p" + r0.post_id}>Ver en la comunidad</Link>}
              {!historial && (
                <>
                  <form action={revisarReporte}><input type="hidden" name="ids" value={ids} /><button className="btn s">Marcar como revisado</button></form>
                  {existe && <form action={eliminarReportado}><input type="hidden" name="ids" value={ids} /><input type="hidden" name="tipo" value={r0.tipo} /><input type="hidden" name="post_id" value={r0.post_id} /><input type="hidden" name="comentario_id" value={r0.comentario_id ?? ""} /><button className="btn sd s">Eliminar {esCom ? "la respuesta" : "la publicación"}</button></form>}
                </>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
