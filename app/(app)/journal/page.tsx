import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import ImportarMT5 from "@/components/ImportarMT5";
import ConfirmarEnvio from "@/components/ConfirmarEnvio";
import BotonImprimir from "@/components/BotonImprimir";
import { agrupar, calcular, type Grupo } from "@/lib/metricas";
import { EMOCIONES, SESIONES } from "@/lib/journal";
import { borrarImportadas, borrarOperacion, guardarOperacion } from "./actions";

export const dynamic = "force-dynamic";

type Op = { id: string; fecha: string; par: string; direccion: string; resultado: number; notas: string; origen?: string; sesion?: string | null; setup?: string | null; emocion?: string | null; respeto_plan?: boolean | null; volumen?: number | null; cierre?: string | null; created_at?: string };
const PARES = ["XAUUSD", "EURUSD", "GBPUSD", "USDCAD"];
const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });

function Tabla({ titulo, g }: { titulo: string; g: Grupo[] }) {
  if (!g.length) return null;
  return (
    <section className="box">
      <h2>{titulo}</h2>
      {g.map((x) => (
        <div key={x.clave} className="ses">
          <div style={{ flex: 1 }}><b>{x.clave}</b><small className="mu" style={{ display: "block" }}>{x.n} operaciones · {Math.round(x.tasa * 100)}% de aciertos · promedio {money(x.prom)}</small></div>
          <span className={x.neto < 0 ? "neg" : "pos"}>{money(x.neto)}</span>
        </div>
      ))}
    </section>
  );
}

export default async function Journal({ searchParams }: { searchParams: { error?: string; p?: string; d?: string; h?: string } }) {
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
  const hoy = hoyPY();
  const sumaDias = (f: string, d: number) => { const x = new Date(f + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const per = searchParams.p ?? "todo";
  let desde = "", hasta = "";
  if (per === "mes") desde = hoy.slice(0, 8) + "01";
  else if (per === "30") desde = sumaDias(hoy, -29);
  else if (per === "90") desde = sumaDias(hoy, -89);
  else if (per === "anio") desde = hoy.slice(0, 4) + "-01-01";
  else if (per === "rango") { desde = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : ""; hasta = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.h ?? "") ? searchParams.h! : ""; }
  const total = todas.length;
  const ops = todas.map((o) => ({ ...o, resultado: Number(o.resultado) })).filter((o) => (!desde || o.fecha >= desde) && (!hasta || o.fecha <= hasta));
  const n = ops.length;
  const om = ops.map((o) => ({ fecha: o.fecha, par: o.par, resultado: o.resultado, cierre: o.cierre ?? null, creado: o.created_at, direccion: o.direccion, sesion: o.sesion, setup: o.setup, emocion: o.emocion, plan: o.respeto_plan ?? null }));
  const m = calcular(om);
  const gDir = agrupar(om, (o) => (o.direccion === "compra" ? "Compras" : o.direccion === "venta" ? "Ventas" : null));
  const gSes = agrupar(om, (o) => o.sesion);
  const gSet = agrupar(om, (o) => o.setup);
  const gEmo = agrupar(om, (o) => o.emocion);
  const gPlan = agrupar(om, (o) => (o.plan === true ? "Siguió su plan" : o.plan === false ? "No siguió su plan" : null));
  const pct = (x: number) => Math.round(x * 100) + "%";
  const comparar = (g: Grupo[], fn: (x: Grupo, y: Grupo) => string) => (g.length >= 2 && g.every((x) => x.n >= 3) ? fn(g[0], g[g.length - 1]) : "");
  const frases = [
    comparar([...gDir].sort((a, b) => b.tasa - a.tasa), (x, y) => "Tu efectividad es mayor en " + x.clave.toLowerCase() + ": " + pct(x.tasa) + " de aciertos (" + money(x.neto) + ") frente a " + pct(y.tasa) + " en " + y.clave.toLowerCase() + " (" + money(y.neto) + ")."),
    comparar(gSes, (x) => "Tu mejor sesión por resultado es " + x.clave + " (" + money(x.neto) + ", " + pct(x.tasa) + " de aciertos)."),
    comparar(gSet, (x) => "Tu estrategia con mejor resultado es \"" + x.clave + "\" (" + money(x.neto) + ")."),
    comparar([...gPlan].sort((a, b) => a.clave.localeCompare(b.clave, "es")), () => { const si = gPlan.find((x) => x.clave === "Siguió su plan"), no = gPlan.find((x) => x.clave === "No siguió su plan"); return si && no ? "Cuando sigues tu plan promedias " + money(si.prom) + " por operación; cuando no, " + money(no.prom) + "." : ""; }),
  ].filter(Boolean);
  const setupsUsados = Array.from(new Set(todas.map((o) => o.setup).filter(Boolean) as string[]));
  const importadas = todas.filter((o) => o.origen === "mt5").length;
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

      <section className="box no-print">
        <h2>Importar reporte de MetaTrader 5</h2>
        <p className="mu">Sube el reporte de tu historial y se cargan todas tus operaciones y métricas de una vez. Si vuelves a subir el mismo reporte, no se duplican.</p>
        <details>
          <summary>¿Cómo descargo el reporte desde MT5?</summary>
          <ol className="mu">
            <li>En MetaTrader 5 abre la pestaña <b>Historial</b> (abajo, en la caja de herramientas) y elige el período que quieres (por ejemplo, "Todo el historial").</li>
            <li>Haz clic derecho sobre la tabla → <b>Reporte</b> → <b>HTML</b> o <b>Excel (XLSX)</b>.</li>
            <li>Guarda el archivo y súbelo aquí (puedes subirlo desde el celular si el archivo está guardado en él). El reporte que genera la app de MT5 en el celular sale en PDF, y por ahora no se puede importar: para HTML o Excel usa MT5 en una computadora.</li>
          </ol>
        </details>
        <ImportarMT5 />
        {importadas > 0 && (
          <form action={borrarImportadas} style={{ marginTop: 12 }}>
            <ConfirmarEnvio mensaje={"¿Borrar las " + importadas + " operaciones importadas de MT5? Tus operaciones anotadas a mano no se tocan."} className="btn g s">Borrar las {importadas} operaciones importadas</ConfirmarEnvio>
          </form>
        )}
      </section>

      {total > 0 && (
        <form method="get" className="box fm no-print" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label>Período del reporte
            <select name="p" defaultValue={per}>
              <option value="todo">Todo el historial</option><option value="mes">Este mes</option><option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option><option value="anio">Este año</option><option value="rango">Entre fechas…</option>
            </select>
          </label>
          <label>Desde<input type="date" name="d" defaultValue={searchParams.d ?? ""} /></label>
          <label>Hasta<input type="date" name="h" defaultValue={searchParams.h ?? ""} /></label>
          <button className="btn s" style={{ marginBottom: 14 }}>Ver</button>
          <BotonImprimir />
        </form>
      )}
      {total > 0 && n === 0 && <p className="mu">No hay operaciones en ese período.</p>}

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

          {frases.length > 0 && (
            <section className="box">
              <h2>Qué dicen tus números</h2>
              {frases.map((f, i) => <p key={i} style={{ margin: "6px 0" }}>• {f}</p>)}
            </section>
          )}
          <div className="cols">
            <Tabla titulo="Compras vs ventas" g={gDir} />
            <Tabla titulo="Por sesión" g={gSes} />
          </div>
          <div className="cols">
            <Tabla titulo="Por estrategia" g={gSet} />
            <Tabla titulo="Por estado emocional" g={gEmo} />
          </div>
          <Tabla titulo="Seguir o no tu plan" g={gPlan} />
          {gSes.length + gSet.length + gEmo.length + gPlan.length === 0 && <p className="mu no-print">Para ver más comparaciones (por sesión, estrategia, emoción y si seguiste tu plan), completa esos datos al anotar tus operaciones.</p>}

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

      <div className="cols no-print">
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
            <div className="f2">
              <label>Lotes (opcional)<input name="volumen" inputMode="decimal" placeholder="Ej.: 0.10" /></label>
              <label>Sesión (opcional)
                <select name="sesion" defaultValue=""><option value="">—</option>{SESIONES.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            </div>
            <div className="f2">
              <label>Precio de entrada (opcional)<input name="precio_ap" inputMode="decimal" /></label>
              <label>Precio de salida (opcional)<input name="precio_ci" inputMode="decimal" /></label>
            </div>
            <div className="f2">
              <label>Estrategia / setup (opcional)<input name="setup" list="setups" maxLength={60} placeholder="Ej.: Ruptura, Reversión…" /></label>
              <label>Estado emocional (opcional)
                <select name="emocion" defaultValue=""><option value="">—</option>{EMOCIONES.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            </div>
            <datalist id="setups">{setupsUsados.map((x) => <option key={x} value={x} />)}</datalist>
            <label>¿Seguiste tu plan? (opcional)
              <select name="respeto_plan" defaultValue=""><option value="">—</option><option value="si">Sí, seguí mi plan</option><option value="no">No, me salí del plan</option></select>
            </label>
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
                <small className="mu" style={{ display: "block" }}>{new Date(o.fecha + "T00:00:00").toLocaleDateString("es-PY")}{o.volumen ? " · " + o.volumen + " lotes" : ""}{o.origen === "mt5" ? " · MT5" : ""}{o.sesion ? " · " + o.sesion : ""}{o.setup ? " · " + o.setup : ""}{o.respeto_plan === false ? " · fuera del plan" : ""}{o.notas ? " · " + o.notas : ""}</small>
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
