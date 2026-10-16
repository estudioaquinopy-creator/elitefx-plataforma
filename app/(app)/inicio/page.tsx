import EnVivo, { type SesionVivo } from "@/components/EnVivo";
import { leerAjustes } from "@/lib/ajustes";
import { ocurrencias, type Fijo } from "@/lib/horario";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos, primerNombre, ZONA, hoyPY } from "@/lib/sesion";
import { youtubeId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

type Curso = { id: string; nombre: string; descripcion: string; grupo: string; orden: number; gratis: boolean };
type Leccion = { id: string; curso_id: string; orden: number; titulo: string; youtube_url: string };

export default async function Inicio() {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const supabase = createClient();

  const { data: cs } = await supabase.from("cursos").select("id, nombre, descripcion, grupo, orden, gratis").eq("grupo", "ruta").order("orden");
  const cursos = (cs ?? []) as Curso[];
  const { data: ls } = await supabase.from("lecciones").select("id, curso_id, orden, titulo, youtube_url").order("orden");
  const lecs = (ls ?? []) as Leccion[];
  const { data: pr } = await supabase.from("progreso").select("leccion_id, completada_at").eq("user_id", perfil.id).order("completada_at", { ascending: false });
  const prog = (pr ?? []) as { leccion_id: string; completada_at: string }[];
  const hechas = new Set(prog.map((x) => x.leccion_id));

  // "Continúa donde lo dejaste": la lección que sigue a la última completada, o la primera disponible.
  let siguiente: Leccion | undefined;
  if (prog.length) {
    const ult = lecs.find((l) => l.id === prog[0].leccion_id);
    if (ult) siguiente = lecs.filter((l) => l.curso_id === ult.curso_id && l.orden > ult.orden && !hechas.has(l.id))[0];
  }
  if (!siguiente) {
    for (const c of cursos) {
      siguiente = lecs.filter((l) => l.curso_id === c.id && !hechas.has(l.id))[0];
      if (siguiente) break;
    }
  }
  const cursoSig = siguiente ? cursos.find((c) => c.id === siguiente!.curso_id) : undefined;
  const vidSig = siguiente ? youtubeId(siguiente.youtube_url) : null;
  const totalSig = cursoSig ? lecs.filter((l) => l.curso_id === cursoSig.id).length : 0;
  const okSig = cursoSig ? lecs.filter((l) => l.curso_id === cursoSig.id && hechas.has(l.id)).length : 0;

  // Próximas sesiones (solo si tiene acceso al calendario).
  let sesiones: { id: string; titulo: string; inicio: string }[] = [];
  if (perm.calendario) {
    const { data } = await supabase.from("clases").select("id, titulo, inicio").gte("inicio", new Date().toISOString()).order("inicio").limit(3);
    const { data: fx } = await supabase.from("horario_fijo").select("*");
    const fijos = ((fx ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
    const ahora = new Date().toISOString();
    sesiones = [...((data ?? []) as typeof sesiones), ...ocurrencias(fijos, hoyPY(), 8).filter((o) => o.inicio >= ahora)]
      .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 3);
  }

  // Sesiones cercanas para el aviso "Empieza en…" y el botón de unirse (solo con acceso al calendario).
  let vivo: SesionVivo[] = [];
  if (perm.calendario) {
    const aj = await leerAjustes();
    const t0 = Date.now() - 90 * 60000, t1 = Date.now() + 3 * 3600000;
    const { data: cl } = await supabase.from("clases").select("id, titulo, inicio, zoom_url").gte("inicio", new Date(t0).toISOString()).lte("inicio", new Date(t1).toISOString());
    const { data: fx } = await supabase.from("horario_fijo").select("*");
    const fijos = ((fx ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
    const hoyIso = hoyPY();
    const ayer = new Date(new Date(hoyIso + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
    vivo = [...((cl ?? []) as { id: string; titulo: string; inicio: string; zoom_url: string }[]), ...ocurrencias(fijos, ayer, 3)]
      .filter((o) => { const t = new Date(o.inicio).getTime(); return t >= t0 && t <= t1; })
      .map((o) => ({ id: o.id, titulo: o.titulo, inicio: o.inicio, zoom: o.zoom_url || aj.zoom_general || "" }));
  }

  const pasos = cursos.map((c) => {
    const total = lecs.filter((l) => l.curso_id === c.id).length;
    const ok = lecs.filter((l) => l.curso_id === c.id && hechas.has(l.id)).length;
    const bloqueado = !(perm.admin || c.gratis || perm.cursos);
    const estado = bloqueado ? "Bloqueado" : total && ok === total ? "Completado" : ok > 0 ? "En curso" : "Pendiente";
    return { c, estado, ok, total, bloqueado };
  });

  return (
    <>
      <h1>Hola, {primerNombre(perfil)}</h1>
      <p className="sub">Este es tu siguiente paso en la academia.</p>
      {perm.calendario && <EnVivo sesiones={vivo} />}
      {!perfil.nombre && (
        <p className="okmsg">Completa tu nombre en <Link href="/perfil?t=editar" style={{ color: "inherit", fontWeight: 700 }}>Editar perfil</Link> para que aparezca aquí y en la comunidad.</p>
      )}

      <div className="cols">
        <div>
          <section className="box hero">
            {siguiente && cursoSig && vidSig ? (
              <Link
                href={"/cursos/" + cursoSig.id + "?l=" + siguiente.id}
                className="th thv"
                aria-label={"Ver " + siguiente.titulo}
                style={{ backgroundImage: "url(https://img.youtube.com/vi/" + vidSig + "/hqdefault.jpg)" }}
              >
                <span className="play">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
                </span>
              </Link>
            ) : (
              <div className="th">ELITE&nbsp;<span>FX</span></div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tag" style={{ marginTop: 0 }}>Continúa donde lo dejaste</div>
              {siguiente && cursoSig ? (
                <>
                  <h2 style={{ margin: "6px 0 4px" }}>{cursoSig.nombre}</h2>
                  <p className="mu" style={{ margin: "0 0 12px" }}>{siguiente.titulo}</p>
                  <div className="bar" style={{ marginBottom: 14 }}><i style={{ width: (totalSig ? Math.round((okSig / totalSig) * 100) : 0) + "%" }} /></div>
                  <Link className="btn sd" href={"/cursos/" + cursoSig.id + "?l=" + siguiente.id}>{okSig ? "Reanudar lección" : "Empezar"}</Link>
                </>
              ) : (
                <>
                  <p className="mu">Aún no hay lecciones para continuar.</p>
                  <Link className="btn s" href="/cursos">Ver cursos</Link>
                </>
              )}
            </div>
          </section>

          <section className="box">
            <h2>Tu ruta de aprendizaje</h2>
            {pasos.length === 0 && <p className="mu">Todavía no hay cursos.</p>}
            {pasos.map(({ c, estado, ok, total, bloqueado }, i) => (
              <Link key={c.id} href={bloqueado ? "/cursos" : "/cursos/" + c.id} className={"step" + (estado === "Completado" ? " done" : "") + (bloqueado ? " lk" : "")}>
                <span className="num">{estado === "Completado" ? "✓" : i + 1}</span>
                <span style={{ flex: 1 }}><b>{c.nombre}</b><small className="mu" style={{ display: "block" }}>{bloqueado ? "Para miembros" : total ? ok + "/" + total + " lecciones" : c.descripcion}</small></span>
                <em>{estado}</em>
              </Link>
            ))}
          </section>
        </div>

        <div>
          {perm.calendario && (
            <section className="box">
              <h2>Próximas sesiones</h2>
              {sesiones.length === 0 && <p className="mu">No hay sesiones programadas todavía.</p>}
              {sesiones.map((s) => {
                const d = new Date(s.inicio);
                return (
                  <div key={s.id} className="ses">
                    <div className="dt">{d.toLocaleDateString("es-PY", { timeZone: ZONA, month: "short" }).toUpperCase()}<b>{d.toLocaleDateString("es-PY", { timeZone: ZONA, day: "numeric" })}</b></div>
                    <div style={{ flex: 1 }}><b>{s.titulo}</b><small className="mu" style={{ display: "block" }}>{d.toLocaleTimeString("es-PY", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false })} · horario de Paraguay</small></div>
                  </div>
                );
              })}
              <Link className="btn bl s" href="/calendario" style={{ marginTop: 10 }}>Ver calendario</Link>
            </section>
          )}
          <section className="box">
            <div className="hd"><h2>Aliados</h2></div>
            <p className="mu">Abre tu cuenta con un broker aliado para desbloquear el Scanner Elite y las sesiones en vivo.</p>
            <Link className="btn bl s" href="/aliados">Ver aliados</Link>
          </section>
        </div>
      </div>
    </>
  );
}
