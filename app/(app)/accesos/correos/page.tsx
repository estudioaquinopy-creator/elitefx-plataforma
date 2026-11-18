import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";
import { leerAjustes } from "@/lib/ajustes";
import { AUDIENCIAS, TOPE_DIA_DEFECTO, inicioDiaUTC } from "@/lib/correos";
import { crearEnvio, enviarTanda, enviarPrueba, eliminarEnvio } from "./actions";

export const dynamic = "force-dynamic";

type Envio = { id: string; creado_at: string; asunto: string; mensaje: string; audiencia: string | null };

const fecha = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function Correos({ searchParams }: { searchParams: { e?: string; ok?: string; error?: string } }) {
  const p = await perfilActual();
  if (p.rol !== "admin") notFound();
  const db = clienteAdmin();
  const aj = await leerAjustes();
  const tope = Math.min(100, Math.max(1, Number(aj.correos_tope_dia) || TOPE_DIA_DEFECTO));
  let envios: Envio[] = [];
  let hoy = 0;
  let sinMigracion = false;
  const cuentas: Record<string, { pendiente: number; enviado: number; fallido: number }> = {};
  if (db) {
    const r = await db.from("correos_envios").select("id,creado_at,asunto,mensaje,audiencia").order("creado_at", { ascending: false }).limit(10);
    if (r.error) sinMigracion = true;
    else {
      envios = (r.data ?? []) as Envio[];
      const h = await db.from("correos_cola").select("id", { count: "exact", head: true }).eq("estado", "enviado").gte("enviado_at", inicioDiaUTC());
      hoy = h.count ?? 0;
      await Promise.all(envios.map(async (e) => {
        const c = async (estado: string[]) => (await db.from("correos_cola").select("id", { count: "exact", head: true }).eq("envio_id", e.id).in("estado", estado)).count ?? 0;
        const [pendiente, enviado, fallido] = await Promise.all([c(["pendiente", "enviando"]), c(["enviado"]), c(["fallido"])]);
        cuentas[e.id] = { pendiente, enviado, fallido };
      }));
    }
  }
  const sel = envios.find((e) => e.id === searchParams.e);
  const queda = Math.max(0, tope - hoy);
  const falloEj: string[] = [];
  if (db && sel) {
    const f = await db.from("correos_cola").select("email,error").eq("envio_id", sel.id).in("estado", ["fallido", "pendiente"]).not("error", "is", null).limit(5);
    for (const x of f.data ?? []) falloEj.push(x.email + ": " + x.error);
  }
  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>Enviar correo</h1>
      <p className="sub">Envía un mensaje por correo a un grupo de personas o a las que elijas. Se manda en tandas según el límite diario de Resend.</p>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {!process.env.RESEND_API_KEY && <p className="alerta">Falta la variable <b>RESEND_API_KEY</b> en Vercel (la clave de Resend, con permiso de envío). Sin ella no se puede enviar.</p>}
      {sinMigracion && <p className="alerta">Falta correr la migración <b>0069_correos_masivos.sql</b> en Supabase.</p>}

      <section className="box">
        <div className="hd"><h2>Hoy</h2></div>
        <p style={{ margin: 0 }}><b>{hoy}</b> de <b>{tope}</b> correos enviados hoy · quedan <b>{queda}</b>.</p>
        <p className="mu" style={{ margin: "6px 0 0" }}>Resend gratis permite 100 por día (cuenta de 21:00 a 21:00, hora de Paraguay) y no tiene límite por hora: los {queda} que quedan se pueden mandar todos juntos en una sola tanda. Dejamos un margen de {100 - tope} para los correos de la cuenta (invitaciones, recuperar contraseña).</p>
      </section>

      <section className="box">
        <div className="hd"><h2>Nuevo envío</h2></div>
        <form className="fm" action={crearEnvio}>
          <div>
            <b>¿A quiénes?</b>
            {AUDIENCIAS.map((a) => (
              <label key={a.id} className="ck"><input type="checkbox" name="grupo" value={a.id} /> <span>{a.etiqueta}</span></label>
            ))}
          </div>
          <label>Personas sueltas (opcional)<textarea name="extras" rows={2} placeholder="correo1@ejemplo.com, correo2@ejemplo.com" /></label>
          <label>Asunto<input name="asunto" maxLength={150} required /></label>
          <label>Mensaje<textarea name="mensaje" rows={9} maxLength={8000} required placeholder={"Escribe el mensaje tal cual. Los saltos de línea se respetan y los enlaces (https://…) se vuelven clicables.\nCada persona recibe el saludo con su nombre y un enlace para dejar de recibir estos correos."} /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sd">Crear envío</button>
            <button className="btn g s" formAction={enviarPrueba}>Enviarme una prueba</button>
          </div>
          <p className="mu" style={{ margin: 0 }}>Al crear el envío se arma la lista (sin quienes pidieron la baja) pero todavía no se manda nada: lo envías desde el listado de abajo.</p>
        </form>
      </section>

      <section className="box">
        <div className="hd"><h2>Envíos recientes</h2></div>
        {envios.length === 0 ? <p className="mu">Todavía no hay envíos.</p> : envios.map((e) => {
          const c = cuentas[e.id] ?? { pendiente: 0, enviado: 0, fallido: 0 };
          const abierto = sel?.id === e.id;
          return (
            <div key={e.id} className="ses" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div><b>{e.asunto}</b><small className="mu" style={{ display: "block" }}>{fecha(e.creado_at)} · {e.audiencia}</small></div>
                <div style={{ textAlign: "right" }}>
                  <span className="pill ok">{c.enviado} enviados</span>{" "}
                  {c.pendiente > 0 && <span className="pill">{c.pendiente} pendientes</span>}{" "}
                  {c.fallido > 0 && <span className="pill st-vencido">{c.fallido} sin enviar</span>}
                </div>
              </div>
              {abierto ? (
                <>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} className="mu">{e.mensaje}</p>
                  {falloEj.length > 0 && <p className="alerta" style={{ margin: 0 }}>{falloEj.join(" · ")}</p>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.pendiente > 0 && (
                      <form action={enviarTanda}><input type="hidden" name="envio" value={e.id} />
                        <button className="btn sd" disabled={queda === 0}>Enviar tanda ahora ({Math.min(queda, c.pendiente)} correos)</button>
                      </form>
                    )}
                    <form action={eliminarEnvio}><input type="hidden" name="envio" value={e.id} /><button className="btn g s">Eliminar envío</button></form>
                  </div>
                  {c.pendiente > 0 && queda === 0 && <p className="mu" style={{ margin: 0 }}>Llegaste al tope de hoy. Podrás enviar la siguiente tanda desde las 21:00 (hora de Paraguay).</p>}
                </>
              ) : <div><Link className="btn g s" href={"/accesos/correos?e=" + e.id}>Abrir</Link></div>}
            </div>
          );
        })}
      </section>
    </>
  );
}
