import EnVivo, { type SesionVivo } from "@/components/EnVivo";
import { ocurrencias, type Fijo } from "@/lib/horario";
import Link from "next/link";
import { redirect } from "next/navigation";
import { bienvenidaPendiente } from "@/lib/bienvenida";
import { noticiasCercanas } from "@/lib/noticias";
import AvisoNoticias from "@/components/AvisoNoticias";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos, primerNombre, ZONA, hoyPY } from "@/lib/sesion";
import { youtubeId } from "@/lib/youtube";
import { bloqueosExamen } from "@/lib/examen";
import { leerAjustes } from "@/lib/ajustes";
import { mesDeRanking } from "@/lib/ranking";
import { rankingLateral, type RankingLateral as DatosRanking } from "@/lib/rankingLateral";
import TarjetaRanking from "@/components/TarjetaRanking";

export const dynamic = "force-dynamic";

type Curso = { id: string; nombre: string; descripcion: string; grupo: string; orden: number; gratis: boolean };
type Leccion = { id: string; curso_id: string; orden: number; titulo: string; youtube_url: string };

export default async function Inicio({ searchParams }: { searchParams: { sim?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const supabase = createClient();

  // Primer video: quien aún no vio la bienvenida va directo a ella.
  const bienv = await bienvenidaPendiente(supabase, perfil.id);
  if (bienv) redirect("/cursos/" + bienv.curso_id + "?l=" + bienv.id + "&bienvenida=1");

  const { data: cs } = await supabase.from("cursos").select("id, nombre, descripcion, grupo, orden, gratis").eq("grupo", "ruta").order("orden");
  const cursos = (cs ?? []) as Curso[];
  const { data: ls } = await supabase.from("lecciones").select("id, curso_id, orden, titulo, youtube_url").order("orden");
  const lecs = (ls ?? []) as Leccion[];
  const { data: pr } = await supabase.from("progreso").select("leccion_id, completada_at").eq("user_id", perfil.id).order("completada_at", { ascending: false });
  const prog = (pr ?? []) as { leccion_id: string; completada_at: string }[];
  const hechas = new Set(prog.map((x) => x.leccion_id));
  let bloqExamen: Record<string, { id: string; nombre: string }> = {};
  if (!perm.admin) { try { bloqExamen = await bloqueosExamen(supabase, perfil.id, cursos, perfil.plan === "gratis"); } catch { bloqExamen = {}; } }

  // "Continúa donde lo dejaste": la lección que sigue a la última completada, o la primera disponible.
  let siguiente: Leccion | undefined;
  if (prog.length) {
    const ult = lecs.find((l) => l.id === prog[0].leccion_id);
    if (ult) siguiente = lecs.filter((l) => l.curso_id === ult.curso_id && l.orden > ult.orden && !hechas.has(l.id))[0];
  }
  if (!siguiente) {
    for (const c of cursos.filter((x) => !bloqExamen[x.id])) {
      siguiente = lecs.filter((l) => l.curso_id === c.id && !hechas.has(l.id))[0];
      if (siguiente) break;
    }
  }
  const cursoSig = siguiente ? cursos.find((c) => c.id === siguiente!.curso_id) : undefined;
  const vidSig = siguiente ? youtubeId(siguiente.youtube_url) : null;
  const totalSig = cursoSig ? lecs.filter((l) => l.curso_id === cursoSig.id).length : 0;
  const okSig = cursoSig ? lecs.filter((l) => l.curso_id === cursoSig.id && hechas.has(l.id)).length : 0;

  // Sesiones para "Próximas sesiones": desde 90 min atrás (para el botón de unirse) hasta 8 días adelante.
  let vivo: SesionVivo[] = [];
  if (perm.calendario) {
    const t0 = Date.now() - 12 * 3600000, t1 = Date.now() + 8 * 86400000;
    const { data: cl } = await supabase.from("clases").select("*").gte("inicio", new Date(t0).toISOString()).lte("inicio", new Date(t1).toISOString()).order("inicio").limit(30);
    const { data: fx } = await supabase.from("horario_fijo").select("*");
    const fijos = ((fx ?? []) as Fijo[]).map((f) => ({ ...f, hora: String(f.hora) }));
    const ayer = new Date(new Date(hoyPY() + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
    vivo = [...((cl ?? []) as { id: string; titulo: string; inicio: string; zoom_url: string; duracion_min?: number }[]), ...ocurrencias(fijos, ayer, 10)]
      .filter((o) => { const t = new Date(o.inicio).getTime(); return t >= t0 && t <= t1; })
      .map((o) => ({ id: o.id, titulo: o.titulo, inicio: o.inicio, zoom: o.zoom_url || "", duracion: o.duracion_min ?? 90 }));
  }

  // Simulación de prueba (solo administrador / modo alumno): /inicio?sim=25 → una sesión que empieza en 25 minutos.
  const sim = searchParams.sim === undefined ? NaN : searchParams.sim === "" ? 60 : Number(searchParams.sim);
  if (!Number.isNaN(sim) && (perfil.rol === "admin" || perfil.vista)) {
    vivo = [...vivo, { id: "sim", titulo: "Trading en vivo · SIMULACIÓN de prueba", inicio: new Date(Date.now() + sim * 60000 - 1000).toISOString(), zoom: "https://meet.google.com", duracion: 90 }];
  }

  // Noticias de alto impacto (de las monedas que la persona eligió) que salen en las próximas horas: el aviso aparece cuando falta 1 hora.
  let avisos: { titulo: string; moneda: string; inicio: string }[] = [];
  if (perm.noticias) {
    try { avisos = (await noticiasCercanas(180)).map((e) => ({ titulo: e.title, moneda: e.country, inicio: e.date })); } catch { avisos = []; }
  }

  // Ranking del mes (si la migración del ranking aún no está corrida, la tarjeta no aparece).
  let ranking: DatosRanking | null = null;
  try {
    ranking = await rankingLateral(perfil, perm, perfil.plan, await leerAjustes(), async () => {
      const { data, error } = await supabase.rpc("ranking_mes", { p_mes: mesDeRanking(hoyPY()) });
      return error ? null : ((data ?? []) as { user_id: string; nombre: string; puntos: number }[]);
    }, hoyPY());
  } catch { ranking = null; }

  const pasos = cursos.map((c) => {
    const total = lecs.filter((l) => l.curso_id === c.id).length;
    const ok = lecs.filter((l) => l.curso_id === c.id && hechas.has(l.id)).length;
    const faltaEx = bloqExamen[c.id];
    const bloqueado = !(perm.admin || c.gratis || perm.cursos) || !!faltaEx;
    const estado = bloqueado ? "Bloqueado" : total && ok === total ? "Completado" : ok > 0 ? "En curso" : "Pendiente";
    return { c, estado, ok, total, bloqueado, faltaEx };
  });

  return (
    <>
      <h1>Hola, {primerNombre(perfil)}</h1>
      <p className="sub">Este es tu siguiente paso en la academia.</p>
      {!perfil.nombre && (
        <p className="okmsg">Completa tu nombre en <Link href="/perfil?t=editar" style={{ color: "inherit", fontWeight: 700 }}>Editar perfil</Link> para que aparezca aquí y en la comunidad.</p>
      )}

      <AvisoNoticias noticias={avisos} />

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
              <div className="th"><img src="/logo-elitefx.png" alt="ELITE FX" style={{ width: "78%", height: "auto" }} /></div>
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
            {pasos.map(({ c, estado, ok, total, bloqueado, faltaEx }, i) => (
              <Link key={c.id} href={bloqueado ? "/cursos" : "/cursos/" + c.id} className={"step" + (estado === "Completado" ? " done" : "") + (bloqueado ? " lk" : "")}>
                <span className="num">{estado === "Completado" ? "✓" : i + 1}</span>
                <span style={{ flex: 1 }}><b>{c.nombre}</b><small className="mu" style={{ display: "block" }}>{faltaEx ? "Aprueba el examen de " + faltaEx.nombre : bloqueado ? "Para miembros" : total ? ok + "/" + total + " lecciones" : c.descripcion}</small></span>
                <em>{estado}</em>
              </Link>
            ))}
          </section>
        </div>

        <div>
          {perm.calendario && (
            <section className="box">
              <h2>Próximas sesiones</h2>
              <EnVivo sesiones={vivo} ahoraServidor={Date.now()} />
              <Link className="btn bl s" href="/calendario" style={{ marginTop: 10 }}>Ver calendario</Link>
            </section>
          )}
          {ranking && <TarjetaRanking d={ranking} />}
          <section className="box">
            <div className="hd"><h2>Broker recomendado</h2></div>
            <p className="mu">Abre tu cuenta con Liquid, nuestro broker recomendado, para desbloquear el Scanner Elite y las sesiones en vivo.</p>
            <Link className="btn bl s" href="/aliados">Abrir mi cuenta</Link>
          </section>
        </div>
      </div>
    </>
  );
}
