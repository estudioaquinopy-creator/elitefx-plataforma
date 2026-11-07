import FormDuda from "@/components/FormDuda";
import TextoMenciones from "@/components/TextoMenciones";
import { preguntarLeccion, responderDuda, borrarDuda } from "@/app/(app)/cursos/actions";

export type Duda = { id: string; user_id: string; autor: string; cuerpo: string; parent_id: string | null; created_at: string };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

// Preguntas y dudas debajo del video: cualquiera con acceso al curso pregunta; solo los educadores (administradores) responden.
export default function DudasLeccion({ leccionId, yo, educador, dudas, falta }: { leccionId: string; yo: string; educador: boolean; dudas: Duda[]; falta?: boolean }) {
  const preguntas = dudas.filter((d) => !d.parent_id);
  const respuestas = (id: string) => dudas.filter((d) => d.parent_id === id);
  return (
    <div id="dudas" className="dudas">
      <h3>Preguntas de esta lección</h3>
      {falta && <p className="alerta">Falta correr la migración 0050 en Supabase para activar las preguntas.</p>}
      {!falta && preguntas.length === 0 && <p className="mu">Todavía no hay preguntas. ¡Haz la primera!</p>}
      {preguntas.map((q) => (
        <div key={q.id} className="duda">
          <div className="duda-q">
            <b>{q.autor}</b> <small className="mu">{cuando(q.created_at)}</small>
            <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}><TextoMenciones texto={q.cuerpo} /></p>
            {(educador || q.user_id === yo) && (
              <form action={borrarDuda}><input type="hidden" name="id" value={q.id} /><button className="lk">Eliminar</button></form>
            )}
          </div>
          {respuestas(q.id).map((r) => (
            <div key={r.id} className="duda-r">
              <b>{r.autor}</b> <span className="pill pos">Educador</span> <small className="mu">{cuando(r.created_at)}</small>
              <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}><TextoMenciones texto={r.cuerpo} /></p>
              {educador && (
                <form action={borrarDuda}><input type="hidden" name="id" value={r.id} /><button className="lk">Eliminar</button></form>
              )}
            </div>
          ))}
          {educador && <FormDuda action={responderDuda} campos={{ parent_id: q.id }} placeholder="Responde esta pregunta…" boton="Responder" />}
        </div>
      ))}
      {!falta && <FormDuda action={preguntarLeccion} campos={{ leccion_id: leccionId }} placeholder="Escribe tu pregunta sobre esta lección… (usa @ para mencionar a un educador)" boton="Preguntar" />}
      {!educador && <p className="mu" style={{ fontSize: 12 }}>Las preguntas las ven los demás alumnos del curso; las responden los educadores.</p>}
    </div>
  );
}
