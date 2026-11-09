import Link from "next/link";
import { perfilActual, hoyPY, vipVigente } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { referidosActivos, puntosReferidos, enlaceReferido, DUENO_EMAIL } from "@/lib/referidos";
import CopiarEnlace from "@/components/CopiarEnlace";

export const dynamic = "force-dynamic";

type Met = { referente_id: string; nombre: string; codigo: string | null; total: number; activos: number; vip: number; ultimos30: number; ultimo: string | null };
type Ref = { nombre: string; registrado: string; activo: boolean; vip: boolean };
const cuando = (iso: string) => new Date(iso).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short" });

export default async function Referidos() {
  const perfil = await perfilActual();
  const aj = await leerAjustes();
  const adminReal = perfil.rol === "admin"; // en modo alumno se comporta como un alumno real (sin atajo)
  const activo = referidosActivos(hoyPY(), aj, adminReal);
  const vip = (vipVigente(perfil) && !perfil.prueba_hasta) || adminReal;
  const pts = puntosReferidos(aj);

  if (!activo) {
    return <><Link href="/comunidad/ranking" className="back">← Ranking</Link><h1>Referidos</h1><section className="box"><p className="mu">Esta función todavía no está disponible.</p></section></>;
  }
  if (!vip) {
    return (
      <>
        <Link href="/comunidad/ranking" className="back">← Ranking</Link>
        <h1>Referidos</h1>
        <section className="box"><div className="tag">{perfil.plan !== "gratis" && !perfil.prueba_hasta ? "Tu membresía VIP venció" : "Solo miembros VIP"}</div><p className="mu">Los miembros VIP pueden invitar amigos con su enlace personal y ganar puntos en el ranking mensual.</p></section>
      </>
    );
  }

  const sb = createClient();
  // Los administradores no tienen referidos: no se les crea código. Solo el dueño ve las métricas de quienes refieren.
  if (adminReal) {
    const dueno = (perfil.email || "").toLowerCase() === DUENO_EMAIL;
    const m = dueno ? await sb.rpc("referidos_metricas") : null;
    const filas = ((m?.data ?? []) as Met[]);
    const t = filas.reduce((a, f) => ({ total: a.total + f.total, activos: a.activos + f.activos, vip: a.vip + f.vip, m30: a.m30 + f.ultimos30 }), { total: 0, activos: 0, vip: 0, m30: 0 });
    const pct = (a: number, b: number) => (b ? Math.round((a * 100) / b) + " %" : "—");
    return (
      <>
        <Link href="/comunidad/ranking" className="back">← Ranking</Link>
        <h1>Referidos · métricas</h1>
        <p className="sub">Los administradores no tienen código de referidos. Aquí ves cómo van los referidos de los miembros VIP.</p>
        {!dueno && <section className="box"><p className="mu">Las métricas de referidos las ve solo el administrador principal.</p></section>}
        {dueno && m?.error && <p className="alerta">Todavía no está activo: corre la migración 0054_referidos_metricas.sql en Supabase.</p>}
        {dueno && !m?.error && (
          <>
            <section className="box">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
                {[["Personas referidas", t.total], ["Activos (1.ª lección)", t.activos + " · " + pct(t.activos, t.total)], ["Pasaron a VIP", t.vip + " · " + pct(t.vip, t.total)], ["Últimos 30 días", t.m30], ["Referentes", filas.length]].map(([k, v]) => (
                  <div key={String(k)}><small className="mu">{k}</small><h2 style={{ margin: "2px 0 0" }}>{v}</h2></div>
                ))}
              </div>
            </section>
            <section className="box">
              <h2>Quiénes más refieren</h2>
              {filas.length === 0 && <p className="mu">Todavía nadie se registró con un código de referido.</p>}
              {filas.map((f, i) => (
                <div key={f.referente_id} className="ses" style={{ padding: "8px 0" }}>
                  <b style={{ width: 28 }}>{i + 1}</b>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{f.nombre}</b><small className="mu" style={{ display: "block" }}>{f.codigo ?? ""}{f.ultimo ? " · último registro " + cuando(f.ultimo) : ""}</small></div>
                  <span className="pill">{f.total} referidos</span>
                  <span className="pill">{f.activos} activos</span>
                  <span className={"pill" + (f.vip ? " ok" : "")}>★ {f.vip} VIP</span>
                </div>
              ))}
            </section>
          </>
        )}
      </>
    );
  }
  const [rc, rl] = await Promise.all([sb.rpc("mi_codigo_referido"), sb.rpc("mis_referidos")]);
  const codigo = (rc.data as string | null) ?? "";
  const falta = !!rc.error;
  const lista = ((rl.data ?? []) as Ref[]);
  const enlace = codigo ? enlaceReferido(codigo) : "";
  const msg = "Te invito a ELITE FX: crea tu cuenta gratis y accede al Curso básico. Regístrate con mi enlace: " + enlace;
  const nActivos = lista.filter((r) => r.activo).length;
  const nVip = lista.filter((r) => r.vip).length;

  return (
    <>
      <Link href="/comunidad/ranking" className="back">← Ranking</Link>
      <h1>Invita y gana puntos</h1>
      <p className="sub">Comparte tu enlace. Quien se registre entra como miembro gratuito y tú sumas puntos en el ranking del mes.</p>
      {falta && <p className="alerta">Todavía no está activo: corre la migración 0027_referidos.sql en Supabase.</p>}

      {codigo && (
        <section className="box" style={{ borderColor: "var(--go)" }}>
          <div className="tag" style={{ marginTop: 0 }}>Tu código</div>
          <h2 style={{ margin: "4px 0 10px", letterSpacing: ".06em" }}>{codigo}</h2>
          <p className="mu" style={{ margin: "0 0 10px", wordBreak: "break-all" }}>{enlace}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <CopiarEnlace texto={enlace} />
            <CopiarEnlace texto={codigo} etiqueta="Copiar solo el código" />
            <a className="btn sd s" href={"https://wa.me/?text=" + encodeURIComponent(msg)} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
          </div>
        </section>
      )}

      <div className="cols">
        <section className="box">
          <h2>Tus referidos ({lista.length})</h2>
          {lista.length === 0 && <p className="mu">Todavía nadie se registró con tu código.</p>}
          {lista.map((r, i) => (
            <div key={i} className="ses" style={{ padding: "8px 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}><b>{r.nombre || "Nuevo miembro"}</b><small className="mu" style={{ display: "block" }}>Registrado el {cuando(r.registrado)}</small></div>
              <span className={"pill" + (r.vip ? " ok" : "")}>{r.vip ? "★ VIP" : r.activo ? "Activo" : "Registrado"}</span>
            </div>
          ))}
          {lista.length > 0 && <small className="mu" style={{ display: "block", marginTop: 10 }}>{nActivos} activos · {nVip} pasaron a VIP</small>}
        </section>

        <section className="box">
          <h2>Cómo suman los puntos</h2>
          {pts.registro > 0 && <div className="ses"><div style={{ flex: 1 }}><b>Tu referido se activa</b><small className="mu" style={{ display: "block" }}>Se registra con tu código y completa su primera lección (máx. {pts.tope} al mes)</small></div><b>{pts.registro} pts</b></div>}
          <div className="ses"><div style={{ flex: 1 }}><b>Tu referido pasa a VIP</b><small className="mu" style={{ display: "block" }}>{pts.registro > 0 ? "Se suma además de los puntos anteriores, en el mes en que se hace VIP" : "Por cada persona que se registra con tu código y se hace VIP, en el mes en que se hace VIP"}</small></div><b>{pts.registro > 0 ? "+" : ""}{pts.vip} pts</b></div>
          <small className="mu" style={{ display: "block", marginTop: 10 }}>Estos puntos no cuentan para el tope diario del ranking. Solo valen referidos nuevos: quienes ya tenían cuenta, o comparten teléfono contigo o con otra cuenta, no suman. ELITE FX puede ajustar o descalificar puntos por conductas de spam o trampa.</small>
        </section>
      </div>
    </>
  );
}
