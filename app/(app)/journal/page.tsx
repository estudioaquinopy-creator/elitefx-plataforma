import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import ImportarMT5 from "@/components/ImportarMT5";
import ConfirmarEnvio from "@/components/ConfirmarEnvio";
import { calcular } from "@/lib/metricas";
import { borrarImportadas, borrarOperacion, guardarOperacion } from "./actions";

export const dynamic = "force-dynamic";

type Op = { id: string; fecha: string; par: string; direccion: string; resultado: number; notas: string; origen?: string; volumen?: number | null; cierre?: string | null; created_at?: string };
const PARES = ["XAUUSD", "EURUSD", "GBPUSD", "USDCAD"];
const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });

export default async function Journal({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.journal) {
    return (
      <>
        <h1>Journal</h1>
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">El journal de trading es para miembros.</p><Link className="btn sd" href="/ayuda">Quiero ser miembro</Link></section>
      </>
    );
  }
  // Se leen todas las operaciones (de a 1000) para calcular las métricas con todo el historial.
  const sb = createClient();
  const todas: Op[] = [];
  for (let pg = 0; pg < 20; pg++) {
    const { data } = await sb.from("operaciones").select("*").eq("user_id", perfil.id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(pg * 1000, pg * 1000 + 999);
    const lote = (data ?? []) as Op[];
    todas.push(...lote);
    if (lote.length < 1000) break;
  }
  const ops = todas.map((o) => ({ ...o, resultado: Number(o.resultado) }));
  const n = ops.length;
  const m = calcular(ops.map((o) => ({ fecha: o.fecha, par: o.par, resultado: o.resultado, cierre: o.cierre ?? null, creado: o.created_at })));
  const importadas = ops.filter((o) => o.origen === "mt5").length;
  const visibles = ops.slice(0, 100);
  const dec = (x: number | null, d = 2) => (x == null ? "—" : x.toLocaleString("es-PY", { maximumFractionDigits: d }));

  // Curva de resultado acumulado (SVG simple).
  const W = 600, H = 160;
  const mn = Math.min(...m.curva), mx = Math.max(...m.curva);
  const rango = mx - mn || 1;
  const puntos = m.curva.map((v, i) => (m.curva.length > 1 ? (i / (m.curva.length - 1)) * W : 0).toFixed(1) + "," + (H - 8 - ((v - mn) / rango) * (H - 16)).toFixed(1)).join(" ");
  const cero = H - 8 - ((0 - mn) / rango) * (H - 16);
  const maxDia = Math.max(1, ...m.porDia.map((d) => Math.abs(d.neto)));

  return (
    <>
      <h1>Journal</h1>
      <p className="sub">Tu diario de trading: registra cada operación y mira tus estadísticas. Es personal; nadie más lo ve.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      <div className="kp">
        <div className="box"><span className="mu">Operaciones</span><b>{n}</b></div>
        <div className="box"><span className="mu">% de aciertos</span><b>{n ? Math.round(m.tasa * 100) + "%" : "—"}</b></div>
        <div className="box"><span className="mu">Resultado neto</span><b className={m.neto < 0 ? "neg" : m.neto > 0 ? "pos" : ""}>{money(m.neto)}</b></div>
        <div className="box"><span className="mu">Mejor / peor</span><b>{n ? money(m.mejor) + " / " + money(m.peor) : "—"}</b></div>
      </div>

      <section className="box">
        <h2>Importar reporte de MetaTrader 5</h2>
        <p className="mu">Sube el reporte de tu historial y se cargan todas tus operaciones y métricas de una vez. Si vuelves a subir el mismo reporte, no se duplican.</p>
        <details>
          <summary>¿Cómo descargo el reporte desde MT5?</summary>
          <ol className="mu">
            <li>En MetaTrader 5 abre la pestaña <b>Historial</b> (abajo, en la caja de herramientas) y elige el período que quieres (por ejemplo, "Todo el historial").</li>
            <li>Haz clic derecho sobre la tabla → <b>Reporte</b> → <b>HTML</b> o <b>Excel (XLSX)</b>.</li>
            <li>Guarda el archivo y súbelo aquí. En el celular, MT5 también permite compartir el reporte desde Historial.</li>
          </ol>
        </details>
        <ImportarMT5 />
        {importadas > 0 && (
          <form action={borrarImportadas} style={{ marginTop: 12 }}>
            <ConfirmarEnvio mensaje={"¿Borrar las " + importadas + " operaciones importadas de MT5? Tus operaciones anotadas a mano no se tocan."} className="btn g s">Borrar las {importadas} operaciones importadas</ConfirmarEnvio>
          </form>
        )}
      </section>

      {n > 0 && (
        <>
          <div className="kp">
            <div className="box"><span className="mu">Profit factor</span><b>{dec(m.pf)}</b></div>
            <div className="box"><span className="mu">Esperanza por operación</span><b className={m.esperanza < 0 ? "neg" : "pos"}>{money(m.esperanza)}</b></div>
            <div className="box"><span className="mu">Ganancia / pérdida promedio</span><b>{money(m.promGanada)} / {money(m.promPerdida)}</b></div>
            <div className="box"><span className="mu">Ratio ganancia/pérdida</span><b>{dec(m.payoff)}</b></div>
            <div className="box"><span className="mu">Drawdown máximo</span><b className="neg">{money(-m.ddMax)}</b></div>
            <div className="box"><span className="mu">Racha máx. ganadoras / perdedoras</span><b>{m.rachaG} / {m.rachaP}</b></div>
          </div>

          <div className="cols">
            <section className="box">
              <h2>Curva de resultado</h2>
              <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto" }} role="img" aria-label="Resultado acumulado">
                <line x1="0" x2={W} y1={cero} y2={cero} stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 4" />
                <polyline points={puntos} fill="none" stroke="var(--ac)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <small className="mu">Resultado acumulado operación por operación (de {money(mn)} a {money(mx)}).</small>
            </section>
            <section className="box">
              <h2>Por día de la semana</h2>
              {m.porDia.map((d) => (
                <div key={d.dia} style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
                  <span style={{ width: 34 }}>{d.dia}</span>
                  <div style={{ flex: 1, height: 10, background: "var(--sf2)", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round((Math.abs(d.neto) / maxDia) * 100) + "%", background: d.neto < 0 ? "var(--co)" : "var(--ac)" }} />
                  </div>
                  <span className={d.neto < 0 ? "neg" : "pos"} style={{ width: 90, textAlign: "right" }}>{d.n ? money(d.neto) : "—"}</span>
                </div>
              ))}
            </section>
          </div>

          <section className="box">
            <h2>Por par</h2>
            {m.porPar.slice(0, 12).map((x) => (
              <div key={x.par} className="ses">
                <div style={{ flex: 1 }}><b>{x.par}</b><small className="mu" style={{ display: "block" }}>{x.n} operaciones · {Math.round(x.tasa * 100)}% de aciertos</small></div>
                <span className={x.neto < 0 ? "neg" : "pos"}>{money(x.neto)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      <div className="cols">
        <section className="box">
          <h2>Nueva operación</h2>
          <form action={guardarOperacion} className="fm">
            <div className="f2">
              <label>Fecha<input type="date" name="fecha" defaultValue={hoyPY()} required /></label>
              <label>Resultado ($, negativo si perdiste)<input name="resultado" inputMode="decimal" placeholder="Ej.: 120 o -45" required /></label>
            </div>
            <div className="f2">
              <label>Par<input name="par" list="pares" defaultValue="XAUUSD" required /></label>
              <label>Dirección
                <select name="direccion" defaultValue="compra"><option value="compra">Compra</option><option value="venta">Venta</option></select>
              </label>
            </div>
            <datalist id="pares">{PARES.map((p) => <option key={p} value={p} />)}</datalist>
            <label>Notas<textarea name="notas" rows={3} placeholder="¿Por qué entraste? ¿Qué aprendiste?" /></label>
            <button className="btn s">Guardar operación</button>
          </form>
        </section>

        <section className="box">
          <h2>Tus operaciones</h2>
          {n === 0 && <p className="mu">Aún no registraste operaciones.</p>}
          {n > 100 && <p className="mu">Mostrando las últimas 100 de {n}.</p>}
          {visibles.map((o) => (
            <div key={o.id} className="ses">
              <div style={{ flex: 1 }}>
                <b>{o.par} · {o.direccion === "compra" ? "Compra" : "Venta"}</b>
                <small className="mu" style={{ display: "block" }}>{new Date(o.fecha + "T00:00:00").toLocaleDateString("es-PY")}{o.volumen ? " · " + o.volumen + " lotes" : ""}{o.origen === "mt5" ? " · MT5" : ""}{o.notas ? " · " + o.notas : ""}</small>
              </div>
              <span className={o.resultado < 0 ? "neg" : "pos"}>{money(o.resultado)}</span>
              <form action={borrarOperacion}>
                <input type="hidden" name="id" value={o.id} />
                <button className="btn g s">Eliminar</button>
              </form>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
