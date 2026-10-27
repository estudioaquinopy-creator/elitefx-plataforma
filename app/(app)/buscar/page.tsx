import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, esMiembro } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Minúsculas y sin tildes, para que "teoria" encuentre "Teoría".
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Curso = { id: string; nombre: string; descripcion: string; gratis: boolean };
type Leccion = { id: string; curso_id: string; titulo: string; descripcion: string; materiales: { titulo: string; url: string }[] };
type Res = { href: string; titulo: string; detalle: string; tipo: string; puntos: number };

export default async function Buscar({ searchParams }: { searchParams: { q?: string } }) {
  const perfil = await perfilActual();
  const q = (searchParams.q ?? "").trim();
  const palabras = norm(q).split(/\s+/).filter(Boolean);
  const res: Res[] = [];

  if (palabras.length) {
    const supabase = createClient();
    const { data: cs } = await supabase.from("cursos").select("id, nombre, descripcion, gratis");
    const { data: ls } = await supabase.from("lecciones").select("id, curso_id, titulo, descripcion, materiales");
    const cursos = (cs ?? []) as Curso[];
    const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]));
    const miembro = esMiembro(perfil);

    // Puntaje: cada palabra debe aparecer en alguna parte; el título pesa más.
    const puntuar = (campos: [string, number][]) => {
      let total = 0;
      for (const p of palabras) {
        let mejor = 0;
        for (const [txt, peso] of campos) if (norm(txt).includes(p)) mejor = Math.max(mejor, peso);
        if (!mejor) return 0;
        total += mejor;
      }
      return total;
    };

    for (const c of cursos) {
      const pts = puntuar([[c.nombre, 4], [c.descripcion, 1]]);
      if (pts && (perfil.rol === "admin" || c.gratis || miembro)) {
        res.push({ href: "/cursos/" + c.id, titulo: c.nombre, detalle: c.descripcion, tipo: "Curso", puntos: pts + 1 });
      }
    }
    for (const l of (ls ?? []) as Leccion[]) {
      const mats = (l.materiales || []).map((m) => m.titulo).join(" ");
      const cn = nombreCurso.get(l.curso_id) ?? "";
      const pts = puntuar([[l.titulo, 5], [cn, 2], [l.descripcion, 2], [mats, 2]]);
      if (pts) res.push({ href: "/cursos/" + l.curso_id + "?l=" + l.id, titulo: l.titulo, detalle: cn, tipo: "Lección", puntos: pts });
    }
    const secciones: [string, string][] = [["Inicio", "/inicio"], ["Cursos", "/cursos"], ["Calendario", "/calendario"], ["Tutoriales", "/tutoriales"], ["Broker", "/aliados"], ["Comunidad", "/comunidad"], ["Journal", "/journal"]];
    for (const [n, h] of secciones) {
      const pts = puntuar([[n, 3]]);
      if (pts) res.push({ href: h, titulo: n, detalle: "Sección de la plataforma", tipo: "Sección", puntos: pts });
    }
    res.sort((a, b) => b.puntos - a.puntos);
  }

  return (
    <>
      <h1>Buscar</h1>
      <p className="sub">{q ? res.length + " resultado(s) para “" + q + "”" : "Escribe en el buscador de arriba."}</p>
      <section className="box">
        {q && res.length === 0 && <p className="mu">No encontramos nada con esas palabras. Prueba con otra o con menos palabras.</p>}
        {res.slice(0, 30).map((r, i) => (
          <Link key={i} href={r.href} className="nitem">
            <span><b>{r.titulo}</b> <span className="pill">{r.tipo}</span></span>
            <small className="mu">{r.detalle}</small>
          </Link>
        ))}
      </section>
    </>
  );
}
