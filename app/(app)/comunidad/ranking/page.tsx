import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { guardarTextos } from "../../ajustes-actions";
import { ajustarPuntos } from "../actions";

export const dynamic = "force-dynamic";

type Fila = { user_id: string; nombre: string; puntos: number; resultados: number; preguntas: number; respuestas: number; utiles: number; likes: number };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4);
const sumaMes = (m: string, d: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
const MEDALLA = ["🥇", "🥈", "🥉"];
const PUESTOS = ["Primer puesto", "Segundo puesto", "Tercer puesto"];

export default async function Ranking({ searchParams }: { searchParams: { m?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad) {
    return (
      <>
        <h1>Ranking</h1>
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">El ranking de la comunidad es para miembros.</p></section>
      </>
    );
  }
  const sb = createClient();
  const aj = await leerAjustes();
  const actual = hoyPY().slice(0, 7);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") && (searchParams.m as string) <= actual ? (searchParams.m as string) : actual;
  const previo = sumaMes(mes, -1);
  // Premios en USDT por puesto (1.º, 2.º y 3.º); el administrador puede cambiarlos. Por defecto 200, 100 y 50.
  const parseados = (aj.ranking_premios ?? "").split(",").map((x) => Number(x.trim().replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
  const premios = [parseados[0] ?? 200, parseados[1] ?? 100, parseados[2] ?? 50];

  const [r1, r2] = await Promise.all([sb.rpc("ranking_mes", { p_mes: mes }), sb.rpc("ranking_mes", { p_mes: previo })]);
  const falta = !!r1.error;
  const filas = (r1.data ?? []) as Fila[];
  const ganadorPrevio = ((r2.data ?? []) as Fila[])[0];
  const miPos = filas.findIndex((f) => f.user_id === perfil.id);
  const yo = miPos >= 0 ? filas[miPos] : null;
  const top = filas.slice(0, 10);
  const esActual = mes === actual;
  // Días que quedan del mes (solo para el mes en curso).
  const [y, mm] = mes.split("-").map(Number);
  const diasMes = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const quedan = esActual ? diasMes - Number(hoyPY().slice(8, 10)) : 0;

  let vips: { id: string; nombre: string; email: string }[] = [];
  if (perm.admin) {
    const { data } = await sb.from("perfiles").select("id, nombre, email, plan, rol").neq("plan", "gratis").neq("rol", "admin").order("nombre").limit(1000);
    vips = (data ?? []) as typeof vips;
  }

  return (
    <>
      <Link href="/comunidad" className="back">← Comunidad</Link>
      <h1>🏆 Ranking de la comunidad</h1>
      <p className="sub">Quienes más participan con calidad ganan puntos cada mes. Solo participan los miembros VIP; los administradores y el equipo de ELITE FX no participan.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {falta && <p className="alerta">Todavía no está activo: corre la migración 0022_ranking.sql en Supabase.</p>}

      <section className="box" style={{ borderColor: "var(--go)" }}>
        <div className="tag" style={{ marginTop: 0 }}>Premios de {nombreMes(mes)}</div>
        {premios.map((n, i) => (
          <div key={i} className="ses" style={{ padding: "8px 0" }}>
            <div className="dt" style={{ minWidth: 46 }}>{MEDALLA[i]}</div>
            <div style={{ flex: 1 }}><b>{PUESTOS[i]}</b></div>
            <b style={{ fontSize: 18 }}>{n} USDT</b>
          </div>
        ))}
        <small className="mu">{esActual ? (quedan === 0 ? "Hoy es el último día del mes." : "Faltan " + quedan + (quedan === 1 ? " día" : " días") + " para que cierre el mes.") : "Mes cerrado."} Horario de Paraguay.</small>
        {ganadorPrevio && <p className="mu" style={{ margin: "10px 0 0" }}>Ganador de {nombreMes(previo)}: <b>{ganadorPrevio.nombre}</b> ({ganadorPrevio.puntos} puntos)</p>}
        {perm.admin && (
          <details className="adm" style={{ marginTop: 10 }}>
            <summary>Editar los premios</summary>
            <form action={guardarTextos} className="fm">
              <input type="hidden" name="ruta" value="/comunidad/ranking" />
              <label>Premios en USDT del 1.º, 2.º y 3.º puesto, separados por coma<input name="ranking_premios" defaultValue={premios.join(", ")} placeholder="200, 100, 50" /></label>
              <button className="btn s">Guardar</button>
            </form>
          </details>
        )}
      </section>

      <div className="chips">
        <Link href={"/comunidad/ranking?m=" + previo} className="chip">← {nombreMes(previo)}</Link>
        <span className="chip on">{nombreMes(mes)}</span>
        {!esActual && <Link href={"/comunidad/ranking?m=" + sumaMes(mes, 1)} className="chip">{nombreMes(sumaMes(mes, 1))} →</Link>}
      </div>

      <div className="cols">
        <section className="box">
          <h2>Top 10</h2>
          {top.length === 0 && !falta && <p className="mu">Todavía nadie sumó puntos este mes. ¡Sé el primero!</p>}
          {top.map((f, i) => (
            <div key={f.user_id} className="ses" style={f.user_id === perfil.id ? { background: "var(--sf2)", borderRadius: 12, padding: "12px", borderBottom: 0 } : undefined}>
              <div className="dt" style={{ minWidth: 46 }}>{MEDALLA[i] ?? "#" + (i + 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{f.nombre}{f.user_id === perfil.id ? " (tú)" : ""}</b>
                <small className="mu" style={{ display: "block" }}>{f.resultados} resultados · {f.preguntas} preguntas · {f.respuestas} respuestas · {f.utiles} útiles · {f.likes} me gusta</small>
              </div>
              <span style={{ textAlign: "right" }}><b style={{ fontSize: 18 }}>{f.puntos} pts</b>{i < 3 && <small className="mu" style={{ display: "block" }}>{premios[i]} USDT</small>}</span>
            </div>
          ))}
          {perm.admin ? null : yo && miPos >= 10 ? (
            <p className="mu" style={{ marginTop: 12 }}>Tu posición: <b>#{miPos + 1}</b> con {yo.puntos} puntos.</p>
          ) : !yo && !falta ? (
            <p className="mu" style={{ marginTop: 12 }}>Aún no tienes puntos este mes. Publica un resultado, haz una pregunta o ayuda a otros.</p>
          ) : null}
        </section>

        <section className="box">
          <h2>Cómo se ganan puntos</h2>
          <div className="ses"><div style={{ flex: 1 }}><b>Publicar un resultado</b><small className="mu" style={{ display: "block" }}>Máx. 2 puntuables al día</small></div><b>3 pts</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>…con imagen (captura)</b></div><b>+1 pt</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>Hacer una pregunta</b><small className="mu" style={{ display: "block" }}>Máx. 2 puntuables al día</small></div><b>2 pts</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>Responder a otro (mín. 20 caracteres)</b><small className="mu" style={{ display: "block" }}>Solo cuenta la primera respuesta en cada publicación (máx. 5 al día)</small></div><b>1 pt</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>Tu respuesta marcada como útil</b><small className="mu" style={{ display: "block" }}>La marca quien preguntó</small></div><b>5 pts</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>Me gusta recibido</b><small className="mu" style={{ display: "block" }}>Máx. 10 por publicación</small></div><b>1 pt</b></div>
          <small className="mu" style={{ display: "block", marginTop: 10 }}>Máximo 12 puntos por día (las respuestas útiles no cuentan para ese tope). No suman: publicaciones muy cortas, responder a tu propia publicación ni dar me gusta a lo tuyo. Si se elimina una publicación, se pierden sus puntos. ELITE FX puede ajustar o descalificar puntos por conductas de spam o trampa.</small>
        </section>
      </div>

      {perm.admin && (
        <details className="box adm">
          <summary>Ajustar puntos manualmente (solo administrador)</summary>
          <form action={ajustarPuntos} className="fm">
            <input type="hidden" name="mes" value={mes} />
            <label>Persona
              <select name="user_id" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {vips.map((v) => <option key={v.id} value={v.id}>{v.nombre || v.email}</option>)}
              </select>
            </label>
            <div className="f2">
              <label>Puntos (negativo para restar)<input name="puntos" type="number" step="1" required placeholder="10 o -5" /></label>
              <label>Motivo<input name="motivo" required maxLength={200} placeholder="Ej.: spam, resultado falso, aporte destacado" /></label>
            </div>
            <button className="btn s">Guardar ajuste en {nombreMes(mes)}</button>
          </form>
        </details>
      )}
    </>
  );
}
