import Link from "next/link";
import { perfilActual, hoyPY } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { youtubeId } from "@/lib/youtube";
import { guardarTextos } from "../ajustes-actions";
import { crearAliado, guardarAliado, eliminarAliado, enviarLiquid } from "./actions";
import { puntosLiquid, puntosLiquidReal } from "@/lib/ranking";

export const dynamic = "force-dynamic";

type Aliado = { id: string; tipo: string; titulo: string; descripcion: string; url: string; boton: string; tutorial_url: string };
const TIPOS = ["Broker", "Tarjeta", "Fondeo", "Otro"];

function Campos({ a }: { a?: Aliado }) {
  return (
    <>
      <div className="f2">
        <label>Tipo
          <select name="tipo" defaultValue={a?.tipo ?? "Broker"}>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Título<input name="titulo" defaultValue={a?.titulo ?? ""} required /></label>
      </div>
      <label>Descripción<textarea name="descripcion" rows={3} defaultValue={a?.descripcion ?? ""} /></label>
      <div className="f2">
        <label>Enlace de registro<input name="url" type="url" defaultValue={a?.url ?? ""} placeholder="https://…" /></label>
        <label>Texto del botón<input name="boton" defaultValue={a?.boton ?? "Abrir cuenta"} /></label>
      </div>
      <label>Tutorial para crear la cuenta (enlace de YouTube, opcional)<input name="tutorial_url" defaultValue={a?.tutorial_url ?? ""} placeholder="https://youtu.be/…" /></label>
    </>
  );
}

export default async function Aliados({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const perfil = await perfilActual();
  const admin = perfil.rol === "admin";
  const aj = await leerAjustes();
  const { data } = await createClient().from("aliados").select("*").order("orden").order("created_at");
  const aliados = (data ?? []) as Aliado[];
  const { data: miLiq } = admin ? { data: null } : await createClient().from("liquid_cuentas").select("cuenta, estado, nota, reward").eq("user_id", perfil.id).eq("mes", hoyPY().slice(0, 7)).maybeSingle();
  const liq = miLiq as { cuenta: string; estado: string; nota: string; reward: number } | null;
  const ptsLiq = puntosLiquid(aj.ranking_pts_liquid);
  const ptsLiqR = puntosLiquidReal(aj.ranking_pts_liquid_real);

  // Tutoriales del broker: se buscan en Tutoriales por el título (crear/abrir cuenta, depositar, retirar), mejor si están en la categoría "Broker".
  const { data: tuts } = await createClient().from("tutoriales").select("id, titulo, categoria").order("created_at", { ascending: false });
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = ((tuts ?? []) as { id: string; titulo: string; categoria: string }[]).map((t) => ({ ...t, n: sinTildes(t.titulo), esBroker: sinTildes(t.categoria).includes("broker") }));
  const buscar = (re: RegExp) => lista.find((t) => t.esBroker && re.test(t.n)) ?? lista.find((t) => re.test(t.n));
  const guias = [
    { texto: "Cómo crear tu cuenta", t: buscar(/crear|abrir|registr/) },
    { texto: "Cómo depositar", t: buscar(/deposit/) },
    { texto: "Cómo retirar", t: buscar(/retir/) },
  ];

  return (
    <>
      <h1>Broker recomendado</h1>
      <p className="sub">Abre tu cuenta con Liquid, nuestro broker recomendado, y empieza a operar con la fórmula.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}

      {admin && (
        <>
          <details className="box adm">
            <summary>+ Agregar broker</summary>
            <form action={crearAliado} className="fm"><Campos /><button className="btn s">Agregar broker</button></form>
          </details>
          <details className="box adm">
            <summary>Texto legal (divulgación)</summary>
            <form action={guardarTextos} className="fm">
              <input type="hidden" name="ruta" value="/aliados" />
              <label>Texto legal<textarea name="aliados_legal" rows={8} defaultValue={aj.aliados_legal ?? ""} /></label>
              <button className="btn s">Guardar</button>
            </form>
          </details>
        </>
      )}

      <div className="cols">
        <div>
          {aliados.length === 0 && <section className="box"><p className="mu">Aún no hay un broker cargado.</p></section>}
          {aliados.map((a) => {
            const vid = youtubeId(a.tutorial_url);
            return (
              <section key={a.id} className="box dest">
                <div className="hd"><h2>{a.titulo}</h2><span className="pill rec">★ Recomendado</span></div>
                <p className="mu">{a.descripcion}</p>
                {a.url ? <a className="btn sd" href={a.url} target="_blank" rel="noopener noreferrer">{a.boton || "Abrir cuenta"}</a> : <p className="mu">Enlace pendiente.</p>}
                {a.tipo === "Broker" && (
                  <div style={{ marginTop: 16 }}>
                    <div className="tag">Tutoriales del broker</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {guias.map((g) => g.t
                        ? <Link key={g.texto} className="btn g s" href={"/tutoriales?v=" + g.t.id}>▶ {g.texto}</Link>
                        : <span key={g.texto} className="btn g s" style={{ opacity: 0.5, cursor: "default" }} title="Próximamente">{g.texto} · próximamente</span>)}
                    </div>
                    {admin && guias.some((g) => !g.t) && <small className="mu" style={{ display: "block", marginTop: 8 }}>Para activar los botones que faltan, sube el video en Tutoriales (categoría "Broker") con un título que incluya "crear cuenta", "depositar" o "retirar".</small>}
                  </div>
                )}
                {vid && (
                  <div style={{ marginTop: 16 }}>
                    <div className="tag">Tutorial</div>
                    <b>Cómo crear tu cuenta en {a.titulo}</b>
                    <div className="vid" style={{ marginTop: 10 }}><iframe src={"https://www.youtube-nocookie.com/embed/" + vid + "?rel=0"} title={"Tutorial de " + a.titulo} allowFullScreen /></div>
                  </div>
                )}
                {admin && (
                  <details className="adm" style={{ marginTop: 12 }}>
                    <summary>Editar</summary>
                    <form action={guardarAliado} className="fm">
                      <input type="hidden" name="id" value={a.id} />
                      <Campos a={a} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn s">Guardar</button>
                        <button className="btn g s" formAction={eliminarAliado}>Eliminar</button>
                      </div>
                    </form>
                  </details>
                )}
              </section>
            );
          })}
          {aj.aliados_legal && <p className="note" style={{ lineHeight: 1.55 }}>{aj.aliados_legal}</p>}
        </div>
        <section className="box">
          <div className="hd"><h2>Tus primeros pasos</h2></div>
          {["Abre y verifica tu cuenta con nuestro enlace", "Realiza tu primer depósito", "Empieza a operar con la fórmula"].map((t, i) => (
            <div key={i} className="ses" style={{ flexWrap: "nowrap", alignItems: "center" }}><div className="dt" style={{ flexShrink: 0 }}>{i + 1}</div><div style={{ flex: 1, minWidth: 0 }}><b>{t}</b></div></div>
          ))}
        </section>
        {!admin && (
          <section className="box">
            <div className="hd"><h2>Registra tu cuenta de Liquid</h2>{liq && <span className={"pill " + (liq.estado === "aprobado" ? "ok" : "")}>{liq.estado === "aprobado" ? "✓ Confirmada" : liq.estado === "rechazado" ? "Rechazada" : "⏳ Pendiente"}</span>}</div>
            <p className="mu">Si abriste tu cuenta con nuestro enlace, escribe aquí el número de tu cuenta de trading de Liquid (el que ves en tu cuenta, no tu correo; por ejemplo ECN_2617822_1). Si eres cliente nuestro, sumas <b>{ptsLiq} puntos</b> en el ranking mensual y otros <b>{ptsLiqR} puntos extra</b> si se detecta que operas en cuenta real (solo para miembros VIP).</p>
            <p className="mu"><b>Solo puedes registrar una cuenta de trading por mes.</b></p>
            {liq?.estado === "aprobado" ? (
              <>
                <p className="okmsg">Tu cuenta <b>{liq.cuenta}</b> fue confirmada. ¡Gracias!{Number(liq.reward) > 0 ? " Detectamos que operas en cuenta real: tus puntos extra ya están confirmados." : ""}</p>
                {Number(liq.reward) <= 0 && <p className="mu">Si operas en cuenta real con esta cuenta, lo detectamos automáticamente y sumas los <b>{ptsLiqR} puntos extra</b> (se actualiza cada día).</p>}
              </>
            ) : (
              <form action={enviarLiquid} className="fm">
                {liq?.estado === "rechazado" && <p className="alerta">No pudimos confirmar ese número de cuenta{liq.nota ? ": " + liq.nota : ""}. Puedes corregirlo y enviarlo de nuevo.</p>}
                {liq?.estado === "pendiente" && (
                  <div className="alerta" style={{ borderColor: "var(--ac)" }}>
                    <b>⏳ Pendiente de confirmación</b> · cuenta <b>{liq.cuenta}</b>
                    <div className="mu" style={{ marginTop: 4 }}>Comparamos tu cuenta con la lista de clientes de Liquid, que se actualiza cada día: puede tardar en promedio <b>24 horas</b> en confirmarse. Si tu cuenta opera en real, también sumarás <b>{ptsLiqR} puntos extra</b>.</div>
                    <div className="mu" style={{ marginTop: 4 }}>Si te equivocaste, puedes enviarla otra vez (sigue contando como tu cuenta de este mes).</div>
                  </div>
                )}
                <label>Número de tu cuenta de trading de Liquid<input name="cuenta" defaultValue={liq?.estado === "rechazado" ? liq.cuenta : ""} maxLength={30} required placeholder="Ej.: ECN_2617822_1" /></label>
                <button className="btn s">{liq ? "Enviar de nuevo" : "Enviar mi cuenta"}</button>
              </form>
            )}
          </section>
        )}
        {admin && (
          <section className="box">
            <div className="hd"><h2>Cuentas de Liquid</h2></div>
            <p className="mu">Revisa los números de cuenta que envían los alumnos y apruébalos si son clientes nuestros.</p>
            <Link className="btn g s" href="/accesos/liquid">Revisar cuentas de Liquid</Link>
          </section>
        )}
      </div>
    </>
  );
}
