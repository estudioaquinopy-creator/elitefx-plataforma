import { perfilActual } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import { youtubeId } from "@/lib/youtube";
import { guardarTextos } from "../ajustes-actions";

export const dynamic = "force-dynamic";

export default async function Aliados({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const admin = perfil.rol === "admin";
  const aj = await leerAjustes();
  const vid = youtubeId(aj.aliados_video || "");
  const campos: [string, string, boolean][] = [
    ["aliados_broker_url", "Broker aliado · Enlace de registro", false],
    ["aliados_broker_desc", "Broker aliado · Descripción", true],
    ["aliados_tarjeta_url", "Tarjeta cripto · Enlace de registro", false],
    ["aliados_tarjeta_desc", "Tarjeta cripto · Descripción", true],
    ["aliados_video", "Tutorial de la tarjeta · Enlace de YouTube", false],
    ["aliados_legal", "Texto legal (divulgación)", true],
  ];
  return (
    <>
      <h1>Aliados</h1>
      <p className="sub">Nuestros aliados para operar y para usar criptomonedas.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {admin && (
        <details className="box adm">
          <summary>Editar aliados</summary>
          <form action={guardarTextos} className="fm">
            <input type="hidden" name="ruta" value="/aliados" />
            {campos.map(([k, label, largo]) => (
              <label key={k}>{label}
                {largo ? <textarea name={k} rows={3} defaultValue={aj[k] ?? ""} /> : <input name={k} defaultValue={aj[k] ?? ""} />}
              </label>
            ))}
            <button className="btn s">Guardar</button>
          </form>
        </details>
      )}

      <div className="cols">
        <div>
          <section className="box">
            <div className="hd"><h2>Broker aliado</h2><span className="pill">Recomendado</span></div>
            <p className="mu">{aj.aliados_broker_desc}</p>
            {aj.aliados_broker_url ? <a className="btn sd" href={aj.aliados_broker_url} target="_blank" rel="noopener noreferrer">Abrir cuenta</a> : <p className="mu">Enlace pendiente.</p>}
          </section>
          <section className="box">
            <div className="hd"><h2>Tarjeta recomendada para usar criptos</h2></div>
            <p className="mu">{aj.aliados_tarjeta_desc}</p>
            {aj.aliados_tarjeta_url ? <a className="btn sd" href={aj.aliados_tarjeta_url} target="_blank" rel="noopener noreferrer">Abrir cuenta</a> : <p className="mu">Enlace pendiente.</p>}
          </section>
          {vid && (
            <section className="box">
              <div className="tag">Tutorial</div>
              <h2>Cómo registrarte y tener tu tarjeta virtual para criptomonedas</h2>
              <div className="vid"><iframe src={"https://www.youtube-nocookie.com/embed/" + vid + "?rel=0"} title="Tutorial de la tarjeta" allowFullScreen /></div>
            </section>
          )}
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
