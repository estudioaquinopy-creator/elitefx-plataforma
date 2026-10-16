import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { youtubeId } from "@/lib/youtube";
import { guardarTextos } from "../ajustes-actions";
import { crearAliado, guardarAliado, eliminarAliado } from "./actions";

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

export default async function Aliados({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const admin = perfil.rol === "admin";
  const aj = await leerAjustes();
  const { data } = await createClient().from("aliados").select("*").order("orden").order("created_at");
  const aliados = (data ?? []) as Aliado[];

  return (
    <>
      <h1>Aliados</h1>
      <p className="sub">Nuestros aliados para operar, fondearte y usar criptomonedas.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {admin && (
        <>
          <details className="box adm">
            <summary>+ Agregar aliado</summary>
            <form action={crearAliado} className="fm"><Campos /><button className="btn s">Agregar aliado</button></form>
          </details>
          <details className="box adm">
            <summary>Texto legal (divulgación)</summary>
            <form action={guardarTextos} className="fm">
              <input type="hidden" name="ruta" value="/aliados" />
              <label>Texto legal<textarea name="aliados_legal" rows={3} defaultValue={aj.aliados_legal ?? ""} /></label>
              <button className="btn s">Guardar</button>
            </form>
          </details>
        </>
      )}

      <div className="cols">
        <div>
          {aliados.length === 0 && <section className="box"><p className="mu">Aún no hay aliados cargados.</p></section>}
          {aliados.map((a) => {
            const vid = youtubeId(a.tutorial_url);
            return (
              <section key={a.id} className="box">
                <div className="hd"><h2>{a.titulo}</h2><span className="pill">{a.tipo}</span></div>
                <p className="mu">{a.descripcion}</p>
                {a.url ? <a className="btn sd" href={a.url} target="_blank" rel="noopener noreferrer">{a.boton || "Abrir cuenta"}</a> : <p className="mu">Enlace pendiente.</p>}
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
          <p className="note">{aj.aliados_legal}</p>
        </div>
        <section className="box">
          <div className="hd"><h2>Tus primeros pasos</h2></div>
          {["Abre y verifica tu cuenta con nuestro enlace", "Realiza tu primer depósito", "Empieza a operar con la fórmula"].map((t, i) => (
            <div key={i} className="ses"><div className="dt">{i + 1}</div><div><b>{t}</b></div></div>
          ))}
        </section>
      </div>
    </>
  );
}
