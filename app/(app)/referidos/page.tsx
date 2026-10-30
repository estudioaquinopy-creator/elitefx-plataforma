import Link from "next/link";
import { perfilActual, hoyPY } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { referidosActivos, puntosReferidos, enlaceReferido } from "@/lib/referidos";
import CopiarEnlace from "@/components/CopiarEnlace";

export const dynamic = "force-dynamic";

type Ref = { nombre: string; registrado: string; activo: boolean; vip: boolean };
const cuando = (iso: string) => new Date(iso).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short" });

export default async function Referidos() {
  const perfil = await perfilActual();
  const aj = await leerAjustes();
  const adminReal = perfil.rol === "admin"; // en modo alumno se comporta como un alumno real (sin atajo)
  const activo = referidosActivos(hoyPY(), aj, adminReal);
  const vip = perfil.plan !== "gratis" || adminReal;
  const pts = puntosReferidos(aj);

  if (!activo) {
    return <><Link href="/comunidad/ranking" className="back">← Ranking</Link><h1>Referidos</h1><section className="box"><p className="mu">Esta función todavía no está disponible.</p></section></>;
  }
  if (!vip) {
    return (
      <>
        <Link href="/comunidad/ranking" className="back">← Ranking</Link>
        <h1>Referidos</h1>
        <section className="box"><div className="tag">Solo miembros VIP</div><p className="mu">Los miembros VIP pueden invitar amigos con su enlace personal y ganar puntos en el ranking mensual.</p></section>
      </>
    );
  }

  const sb = createClient();
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
      {adminReal && perfil.rol === "admin" && <p className="okmsg">Vista previa de administrador: los miembros la verán desde el 9 de noviembre.</p>}
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
          <div className="ses"><div style={{ flex: 1 }}><b>Tu referido se activa</b><small className="mu" style={{ display: "block" }}>Se registra con tu código y completa su primera lección (máx. {pts.tope} al mes)</small></div><b>{pts.registro} pts</b></div>
          <div className="ses"><div style={{ flex: 1 }}><b>Tu referido pasa a VIP</b><small className="mu" style={{ display: "block" }}>Se suma además de los puntos anteriores, en el mes en que se hace VIP</small></div><b>+{pts.vip} pts</b></div>
          <small className="mu" style={{ display: "block", marginTop: 10 }}>Estos puntos no cuentan para el tope diario del ranking. Solo valen referidos nuevos: quienes ya tenían cuenta, o comparten teléfono contigo o con otra cuenta, no suman. ELITE FX puede ajustar o descalificar puntos por conductas de spam o trampa.</small>
        </section>
      </div>
    </>
  );
}
