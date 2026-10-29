import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import BotonEnvio from "@/components/BotonEnvio";
import { cursoSinExamen } from "@/lib/examen";
import { agregarPregunta, borrarPregunta, enviarExamen, guardarConfig, importarPreguntas } from "./actions";

export const dynamic = "force-dynamic";

type Banco = { id: string; texto: string; opciones: string[]; correcta: number };
type Preg = { id: string; texto: string; opciones: string[] };
const EJEMPLO = `1. ¿Qué es un pip?
a) La unidad mínima de movimiento de un par
*b) Una comisión del broker
c) Un tipo de orden

2. ¿Qué es el spread?
a) El apalancamiento
*b) La diferencia entre el precio de compra y de venta
c) El horario de Londres`;

export default async function Examen({ params, searchParams }: { params: { id: string }; searchParams: { a?: string; t?: string; m?: string; ok?: string; error?: string } }) {
  const perfil = await perfilActual();
  const admin = perfil.rol === "admin";
  const sb = createClient();
  const { data: curso } = await sb.from("cursos").select("id, nombre, orden").eq("id", params.id).single();
  if (!curso || cursoSinExamen(curso.nombre)) notFound();
  const { data: cfgRaw } = await sb.from("examen_config").select("*").eq("curso_id", params.id).maybeSingle();
  const cfg = cfgRaw as { activo: boolean; preguntas: number; minimo: number } | null;

  const { data: lecs } = await sb.from("lecciones").select("id").eq("curso_id", params.id);
  const { data: prog } = await sb.from("progreso").select("leccion_id").eq("user_id", perfil.id);
  const hechas = new Set((prog ?? []).map((p: { leccion_id: string }) => p.leccion_id));
  const lista = (lecs ?? []) as { id: string }[];
  const completo = lista.length > 0 && lista.every((l) => hechas.has(l.id));
  const { data: ap } = await sb.from("examen_intentos").select("aciertos, total").eq("user_id", perfil.id).eq("curso_id", params.id).eq("aprobado", true).order("aciertos", { ascending: false }).limit(1);
  const aprobado = (ap ?? [])[0] as { aciertos: number; total: number } | undefined;

  // Siguiente curso de la ruta (para el enlace al aprobar).
  const { data: sig } = await sb.from("cursos").select("id, nombre").eq("grupo", "ruta").gt("orden", curso.orden).order("orden").limit(1);
  const siguiente = (sig ?? [])[0] as { id: string; nombre: string } | undefined;

  const cabeza = (
    <>
      <Link href={"/cursos/" + params.id} className="back">← {curso.nombre}</Link>
      <h1>Examen · {curso.nombre}</h1>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
    </>
  );

  // Resultado recién calificado
  if (searchParams.ok !== undefined) {
    const pasa = searchParams.ok === "1";
    return (
      <>
        {cabeza}
        <section className="box">
          <div className="tag">{pasa ? "¡Aprobado!" : "Aún no alcanzas"}</div>
          <h2>{searchParams.a} de {searchParams.t} respuestas correctas</h2>
          <p className="mu">{pasa ? "Superaste el mínimo de " + searchParams.m + " respuestas correctas." : "Necesitas al menos " + searchParams.m + " respuestas correctas. Repasa las lecciones y vuelve a intentarlo: las preguntas cambian en cada intento."}</p>
          {pasa && <p><Link className="btn sd" href={"/cursos/" + params.id + "/certificado"}>🎓 Obtener mi certificado</Link></p>}
          {pasa && siguiente
            ? <Link className="btn bl" href={"/cursos/" + siguiente.id}>Ir a {siguiente.nombre}</Link>
            : <Link className="btn sd" href={pasa ? "/cursos" : "/cursos/" + params.id + "/examen"}>{pasa ? "Ver cursos" : "Intentar de nuevo"}</Link>}
        </section>
      </>
    );
  }

  // Panel del administrador
  if (admin) {
    const { data: bq } = await sb.from("examen_banco").select("*").eq("curso_id", params.id).order("created_at");
    const banco = (bq ?? []) as Banco[];
    const pide = cfg?.preguntas ?? 10;
    return (
      <>
        {cabeza}
        <section className="box adm" style={{ display: "block" }}>
          <h2>Configuración</h2>
          <p className="mu">Cada alumno recibe {pide} preguntas al azar del banco y debe acertar {cfg?.minimo ?? 7} para aprobar. Mientras no aprueben, no pueden abrir el siguiente curso de la ruta. Tú (administrador) no estás sujeto a este bloqueo.</p>
          <form action={guardarConfig} className="fm">
            <input type="hidden" name="curso_id" value={params.id} />
            <div className="f2">
              <label>Preguntas por examen<input type="number" name="preguntas" min={1} max={100} defaultValue={cfg?.preguntas ?? 10} required /></label>
              <label>Respuestas correctas para aprobar<input type="number" name="minimo" min={1} max={100} defaultValue={cfg?.minimo ?? 7} required /></label>
            </div>
            <label className="ck"><input type="checkbox" name="activo" defaultChecked={cfg ? cfg.activo : true} /> Examen activo (exigido para avanzar)</label>
            <button className="btn s">Guardar configuración</button>
          </form>
          {!cfg && <p className="alerta">El examen todavía no está activo: guarda la configuración cuando tengas las preguntas cargadas.</p>}
          {banco.length < pide && <p className="alerta">Tienes {banco.length} pregunta(s) y el examen pide {pide}. Agrega al menos {pide - banco.length} más; con más preguntas en el banco, cada intento será distinto.</p>}
        </section>

        <details className="box adm">
          <summary>+ Cargar varias preguntas de una vez</summary>
          <form action={importarPreguntas} className="fm">
            <input type="hidden" name="curso_id" value={params.id} />
            <p className="mu">Separa cada pregunta con una línea en blanco. Escribe las opciones debajo y marca la correcta con un asterisco (*) al inicio.</p>
            <label>Preguntas<textarea name="texto" rows={12} placeholder={EJEMPLO} required /></label>
            <button className="btn s">Agregar preguntas</button>
          </form>
        </details>

        <details className="box adm">
          <summary>+ Agregar una pregunta</summary>
          <form action={agregarPregunta} className="fm">
            <input type="hidden" name="curso_id" value={params.id} />
            <label>Pregunta<input name="texto" required /></label>
            {[1, 2, 3, 4].map((i) => <label key={i}>Opción {i}<input name={"o" + i} required={i <= 2} /></label>)}
            <label>Opción correcta
              <select name="correcta" defaultValue="0">{[0, 1, 2, 3].map((i) => <option key={i} value={i}>Opción {i + 1}</option>)}</select>
            </label>
            <button className="btn s">Agregar</button>
          </form>
        </details>

        <section className="box">
          <h2>Banco de preguntas ({banco.length})</h2>
          {banco.length === 0 && <p className="mu">Todavía no hay preguntas.</p>}
          {banco.map((q, i) => (
            <div key={q.id} className="ses" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <b>{i + 1}. {q.texto}</b>
                {q.opciones.map((o, j) => <small key={j} style={{ display: "block", color: j === q.correcta ? "var(--ac)" : undefined }} className={j === q.correcta ? "" : "mu"}>{j === q.correcta ? "✓ " : "• "}{o}</small>)}
              </div>
              <form action={borrarPregunta}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="curso_id" value={params.id} /><button className="lk">Eliminar</button></form>
            </div>
          ))}
        </section>
      </>
    );
  }

  // Alumno
  if (!cfg || !cfg.activo) return <>{cabeza}<section className="box"><p className="mu">Este curso no tiene examen.</p></section></>;
  if (!completo) {
    const ok = lista.filter((l) => hechas.has(l.id)).length;
    return <>{cabeza}<section className="box"><div className="tag">Aún no disponible</div><p className="mu">Completa todas las lecciones del curso para rendir el examen ({ok}/{lista.length}).</p><Link className="btn sd" href={"/cursos/" + params.id}>Volver al curso</Link></section></>;
  }
  const { data: pq, error } = await sb.rpc("examen_preguntas", { p_curso: params.id });
  const preguntas = (pq ?? []) as Preg[];
  if (error || preguntas.length === 0) return <>{cabeza}<section className="box"><p className="mu">El examen todavía no está listo. Vuelve más tarde.</p></section></>;

  return (
    <>
      {cabeza}
      {aprobado && <p className="okmsg">Ya aprobaste este examen ({aprobado.aciertos}/{aprobado.total}). <Link href={"/cursos/" + params.id + "/certificado"} style={{ color: "inherit", fontWeight: 700 }}>Ver mi certificado</Link>. Puedes volver a rendirlo si quieres.</p>}
      <p className="sub">{preguntas.length} preguntas · necesitas {cfg.minimo} respuestas correctas para aprobar.</p>
      <form action={enviarExamen} className="fm">
        <input type="hidden" name="curso_id" value={params.id} />
        {preguntas.map((q, i) => (
          <section key={q.id} className="box">
            <b>{i + 1}. {q.texto}</b>
            {q.opciones.map((o, j) => (
              <label key={j} className="ck" style={{ marginTop: 8 }}><input type="radio" name={"p_" + q.id} value={j} /> {o}</label>
            ))}
          </section>
        ))}
        <BotonEnvio className="btn sd" enviando="Calificando…">Enviar examen</BotonEnvio>
      </form>
    </>
  );
}
