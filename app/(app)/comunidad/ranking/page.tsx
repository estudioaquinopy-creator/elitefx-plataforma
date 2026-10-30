import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { guardarTextos } from "../../ajustes-actions";
import { ajustarPuntos } from "../actions";
import { referidosActivos, puntosReferidos, REFERIDOS_DESDE } from "@/lib/referidos";
import { mesDeRanking, ultimoViernes, cierreISO, textoFecha, premiosRanking, puntosCertificado } from "@/lib/ranking";
import CuentaRanking from "@/components/CuentaRanking";

export const dynamic = "force-dynamic";

type Fila = { user_id: string; nombre: string; puntos: number; resultados: number; preguntas: number; respuestas: number; utiles: number; likes: number; certificados?: number; referidos?: number };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4);
const sumaMes = (m: string, d: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
const MEDALLA = ["🥇", "🥈", "🥉"];
const PUESTOS = ["Primer puesto", "Segundo puesto", "Tercer puesto"];

export default async function Ranking({ searchParams }: { searchParams: { m?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const gratis = !perm.admin && perfil.plan === "gratis"; // los miembros gratuitos pueden ver el ranking, pero no participan
  const sb = createClient();
  const aj = await leerAjustes();
  // El ranking en curso es el del mes cuyo último viernes todavía no pasó (desde el sábado ya corre el del mes siguiente).
  const actual = mesDeRanking(hoyPY());
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") && (searchParams.m as string) <= actual ? (searchParams.m as string) : actual;
  const previo = sumaMes(mes, -1);
  // Premios en USDT por puesto (1.º, 2.º y 3.º); el administrador puede cambiarlos. Por defecto 200, 100 y 50.
  const premios = premiosRanking(aj.ranking_premios);
  const ptsCert = puntosCertificado(aj.ranking_pts_certificado);
  const refAct = referidosActivos(hoyPY(), aj, perm.admin || !!perfil.vista); // los referidos se muestran desde el 9 de noviembre (antes, solo al administrador)
  const pr = puntosReferidos(aj);

  const [r1, r2] = await Promise.all([sb.rpc("ranking_mes", { p_mes: mes }), sb.rpc("ranking_mes", { p_mes: previo })]);
  const falta = !!r1.error;
  const filas = (r1.data ?? []) as Fila[];
  const ganadoresPrevio = ((r2.data ?? []) as Fila[]).slice(0, 3);
  const miPos = filas.findIndex((f) => f.user_id === perfil.id);
  const yo = miPos >= 0 ? filas[miPos] : null;
  const top = filas.slice(0, 10);
  const esActual = mes === actual;
  const viernes = ultimoViernes(mes);

  let vips: { id: string; nombre: string; email: string }[] = [];
  if (perm.admin) {
    const { data } = await sb.from("perfiles").select("id, nombre, email, plan, rol").neq("plan", "gratis").neq("rol", "admin").order("nombre").limit(1000);
    vips = (data ?? []) as typeof vips;
  }

  return (
    <>
      <Link href={perm.comunidad ? "/comunidad" : "/inicio"} className="back">{perm.comunidad ? "← Comunidad" : "← Inicio"}</Link>
      <h1>🏆 Ranking de la comunidad</h1>
      <p className="sub">Quienes más participan con calidad ganan puntos cada mes. Solo participan los miembros VIP; los administradores y el equipo de ELITE FX no participan.</p>
      {gratis && (
        <section className="box" style={{ borderColor: "var(--go)" }}>
          <div className="tag" style={{ marginTop: 0 }}>Solo los miembros VIP participan</div>
          <p className="mu">Estás viendo el ranking como miembro gratuito. Con la membresía VIP, lo que aportas en la comunidad suma puntos y puedes ganarte los premios en USDT cada mes.</p>
          <a className="btn sd" href={"https://wa.me/595987174242?text=" + encodeURIComponent("Hola, quiero la membresía VIP de ELITE FX")} target="_blank" rel="noopener noreferrer">Quiero ser VIP</a>
        </section>
      )}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {falta && <p className="alerta">Todavía no está activo: corre las migraciones 0022 a 0026 del ranking en Supabase.</p>}

      <section className="box" style={{ borderColor: "var(--go)" }}>
        <div className="tag" style={{ marginTop: 0 }}>Premios de {nombreMes(mes)}</div>
        {premios.map((n, i) => (
          <div key={i} className="ses" style={{ padding: "8px 0" }}>
            <div className="dt" style={{ minWidth: 46 }}>{MEDALLA[i]}</div>
            <div style={{ flex: 1 }}><b>{PUESTOS[i]}</b></div>
            <b style={{ fontSize: 18 }}>{n} USDT</b>
          </div>
        ))}
        {esActual && (
          <>
            <div className="tag">El ranking cierra en</div>
            <CuentaRanking cierre={cierreISO(mes)} />
          </>
        )}
        <small className="mu">{esActual ? "Cierra el " + textoFecha(viernes) + " a las 23:59 (último viernes del mes, hora de Paraguay). Lo que publiques desde el sábado cuenta para el mes siguiente." : "Mes cerrado el " + textoFecha(viernes) + " a las 23:59 (hora de Paraguay)."}</small>
        {ganadoresPrevio.length > 0 && (
          <p className="mu" style={{ margin: "10px 0 0" }}>
            Ganadores de {nombreMes(previo)}: {ganadoresPrevio.map((g, i) => <span key={g.user_id}>{i > 0 ? " · " : ""}{MEDALLA[i]} <b>{g.nombre}</b> ({g.puntos} pts)</span>)}
          </p>
        )}
        {perm.admin && (
          <details className="adm" style={{ marginTop: 10 }}>
            <summary>Editar los premios</summary>
            <form action={guardarTextos} className="fm">
              <input type="hidden" name="ruta" value="/comunidad/ranking" />
              <label>Premios en USDT del 1.º, 2.º y 3.º puesto, separados por coma<input name="ranking_premios" defaultValue={premios.join(", ")} placeholder="200, 100, 50" /></label>
              <label>Puntos por cada certificado<input name="ranking_pts_certificado" type="number" min={0} max={999} step={1} defaultValue={ptsCert} /></label>
              <label>Referidos · puntos cuando el referido se activa<input name="ranking_pts_ref" type="number" min={0} max={999} step={1} defaultValue={pr.registro} /></label>
              <label>Referidos · puntos extra cuando pasa a VIP<input name="ranking_pts_ref_vip" type="number" min={0} max={999} step={1} defaultValue={pr.vip} /></label>
              <label>Referidos · máximo de activaciones puntuables por mes<input name="ranking_ref_tope" type="number" min={0} max={999} step={1} defaultValue={pr.tope} /></label>
              <label>Referidos · fecha de inicio (la base de datos usa esta fecha; por defecto {REFERIDOS_DESDE})<input name="referidos_desde" type="date" defaultValue={(aj.referidos_desde ?? "").trim() || REFERIDOS_DESDE} /></label>
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
          {top.length === 0 && !falta && <p className="mu">Todavía nadie sumó puntos este mes.{gratis ? "" : " ¡Sé el primero!"}</p>}
          {top.map((f, i) => (
            <div key={f.user_id} className="ses" style={f.user_id === perfil.id ? { background: "var(--sf2)", borderRadius: 12, padding: "12px", borderBottom: 0 } : undefined}>
              <div className="dt" style={{ minWidth: 46 }}>{MEDALLA[i] ?? "#" + (i + 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{f.nombre}{f.user_id === perfil.id ? " (tú)" : ""}</b>
                <small className="mu" style={{ display: "block" }}>{f.resultados} resultados · {f.preguntas} preguntas · {f.respuestas} respuestas · {f.utiles} útiles · {f.likes} me gusta{f.certificados ? " · " + f.certificados + (f.certificados === 1 ? " certificado" : " certificados") : ""}{f.referidos ? " · " + f.referidos + (f.referidos === 1 ? " referido" : " referidos") : ""}</small>
              </div>
              <span style={{ textAlign: "right" }}><b style={{ fontSize: 18 }}>{f.puntos} pts</b>{i < 3 && <small className="mu" style={{ display: "block" }}>{premios[i]} USDT</small>}</span>
            </div>
          ))}
          {perm.admin || gratis ? null : yo && miPos >= 10 ? (
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
          <div className="ses"><div style={{ flex: 1 }}><b>🎓 Obtener un certificado</b><small className="mu" style={{ display: "block" }}>Al aprobar el examen de Curso básico, intermedio o avanzado (suma en el mes en que apruebas)</small></div><b>{ptsCert} pts</b></div>
          {refAct && <div className="ses"><div style={{ flex: 1 }}><b>👥 Tu referido se activa</b><small className="mu" style={{ display: "block" }}>Se registra con tu código y completa su primera lección (máx. {pr.tope} al mes)</small></div><b>{pr.registro} pts</b></div>}
          {refAct && <div className="ses"><div style={{ flex: 1 }}><b>⭐ Tu referido pasa a VIP</b><small className="mu" style={{ display: "block" }}>Se suma además de los puntos anteriores, en el mes en que se hace VIP</small></div><b>+{pr.vip} pts</b></div>}
          <small className="mu" style={{ display: "block", marginTop: 10 }}>Máximo 12 puntos por día (las respuestas útiles, los certificados y los referidos no cuentan para ese tope). No suman: publicaciones muy cortas, responder a tu propia publicación ni dar me gusta a lo tuyo. El mes cierra el último viernes a las 23:59 (hora de Paraguay). Si se elimina una publicación, se pierden sus puntos. ELITE FX puede ajustar o descalificar puntos por conductas de spam o trampa.</small>
          {refAct && !gratis && <Link className="btn sd s" href="/referidos" style={{ marginTop: 12 }}>👥 Invitar amigos y ganar puntos</Link>}
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
