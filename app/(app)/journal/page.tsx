import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { perfilActual, permisos, hoyPY } from "@/lib/sesion";
import ImportarMT5 from "@/components/ImportarMT5";
import ConfirmarEnvio from "@/components/ConfirmarEnvio";
import BotonImprimir from "@/components/BotonImprimir";
import { agrupar, calcular, type Grupo } from "@/lib/metricas";
import { EMOCIONES, SESIONES } from "@/lib/journal";
import { generarConsejos } from "@/lib/consejos";
import { registrar } from "@/lib/auditoria";
import { borrarImportadas, borrarOperacion, guardarCapital, guardarOperacion } from "./actions";

export const dynamic = "force-dynamic";

type Op = { id: string; fecha: string; par: string; direccion: string; resultado: number; notas: string; origen?: string; sesion?: string | null; setup?: string | null; emocion?: string | null; respeto_plan?: boolean | null; volumen?: number | null; cierre?: string | null; created_at?: string };
const PARES = ["XAUUSD", "EURUSD", "GBPUSD", "USDCAD"];
const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });

function Tabla({ titulo, g, mp }: { titulo: string; g: Grupo[]; mp: (n: number) => string }) {
  if (!g.length) return null;
  return (
    <section className="box">
      <h2>{titulo}</h2>
      {g.map((x) => (
        <div key={x.clave} className="ses">
          <div style={{ flex: 1 }}><b>{x.clave}</b><small className="mu" style={{ display: "block" }}>{x.n} operaciones · {Math.round(x.tasa * 100)}% de aciertos · promedio {mp(x.prom)}</small></div>
          <span className={x.neto < 0 ? "neg" : "pos"}>{mp(x.neto)}</span>
        </div>
      ))}
    </section>
  );
}

export default async function Journal({ searchParams }: { searchParams: { alumno?: string; error?: string; p?: string; d?: string; h?: string; m?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  // El administrador puede VER (solo lectura) el journal de un alumno: /journal?alumno=<id> (desde Accesos → Ver journal).
  const alumnoId = /^[0-9a-f-]{36}$/i.test(searchParams.alumno ?? "") ? searchParams.alumno! : "";
  const ver = perfil.rol === "admin" && !!alumnoId && alumnoId !== perfil.id;
  const uid = ver ? alumnoId : perfil.id;
  let duenio = "";
  if (ver) {
    const { data: dp } = await createClient().from("perfiles").select("nombre, email").eq("id", alumnoId).maybeSingle();
    if (!dp) return <><Link href="/accesos" className="back">← Accesos</Link><h1>Journal</h1><p className="alerta">No se encontró a esa persona.</p></>;
    duenio = (dp as { nombre: string | null; email: string }).nombre || (dp as { email: string }).email;
    // Se deja constancia al abrirlo (no al cambiar filtros del mismo journal).
    if (!searchParams.p && !searchParams.m && !searchParams.d && !searchParams.h) await registrar("ver_journal", duenio);
  }
  if (!ver && !perm.journal) {
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
    const { data } = await sb.from("operaciones").select("*").eq("user_id", uid).order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(pg * 1000, pg * 1000 + 999);
    const lote = (data ?? []) as Op[];
    todas.push(...lote);
    if (lote.length < 1000) break;
  }
  const { data: cfg } = await sb.from("journal_config").select("capital_inicial").eq("user_id", uid).maybeSingle();
  const capital = Number((cfg as { capital_inicial: number } | null)?.capital_inicial ?? 0) || 0;
  // Porcentaje de un monto sobre el capital inicial (vacío si todavía no se definió el capital).
  const pc = (x: number) => (capital > 0 ? (x > 0 ? "+" : "") + ((x / capital) * 100).toLocaleString("es-PY", { maximumFractionDigits: 2 }) + "%" : "");
  const mp = (x: number) => money(x) + (capital > 0 ? " (" + pc(x) + ")" : "");
  const sub = (x: number) => (capital > 0 ? <small className="mu" style={{ display: "block" }}>{pc(x)} del capital inicial</small> : null);
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
  const om = ops.map((o) => ({ fecha: o.fecha, par: o.par, resultado: o.resultado, apertura: o.apertura ?? null, cierre: o.cierre ?? null, creado: o.created_at, direccion: o.direccion, sesion: o.sesion, setup: o.setup, emocion: o.emocion, plan: o.respeto_plan ?? null }));
  const m = calcular(om);
  const gDir = agrupar(om, (o) => (o.direccion === "compra" ? "Compras" : o.direccion === "venta" ? "Ventas" : null));
  const gSes = agrupar(om, (o) => o.sesion);
  const gSet = agrupar(om, (o) => o.setup);
  const gEmo = agrupar(om, (o) => o.emocion);
  const gPlan = agrupar(om, (o) => (o.plan === true ? "Siguió su plan" : o.plan === false ? "No siguió su plan" : null));
  const pct = (x: number) => Math.round(x * 100) + "%";
  const comparar = (g: Grupo[], fn: (x: Grupo, y: Grupo) => string) => (g.length >= 2 && g.every((x) => x.n >= 3) ? fn(g[0], g[g.length - 1]) : "");
  const frases = [
    comparar([...gDir].sort((a, b) => b.tasa - a.tasa), (x, y) => "Tu efectividad es mayor en " + x.clave.toLowerCase() + ": " + pct(x.tasa) + " de aciertos (" + mp(x.neto) + ") frente a " + pct(y.tasa) + " en " + y.clave.toLowerCase() + " (" + mp(y.neto) + ")."),
    comparar(gSes, (x) => "Tu mejor sesión por resultado es " + x.clave + " (" + mp(x.neto) + ", " + pct(x.tasa) + " de aciertos)."),
    comparar(gSet, (x) => "Tu estrategia con mejor resultado es \"" + x.clave + "\" (" + mp(x.neto) + ")."),
    comparar([...gPlan].sort((a, b) => a.clave.localeCompare(b.clave, "es")), () => { const si = gPlan.find((x) => x.clave === "Siguió su plan"), no = gPlan.find((x) => x.clave === "No siguió su plan"); return si && no ? "Cuando sigues tu plan promedias " + mp(si.prom) + " por operación; cuando no, " + mp(no.prom) + "." : ""; }),
  ].filter(Boolean);
  // Video del tutorial "Descargar historial de MetaTrader" (se busca en Tutoriales por el título).
  const { data: tutsMT } = await sb.from("tutoriales").select("id, titulo").order("created_at", { ascending: false });
  const normT = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const videoMT = ((tutsMT ?? []) as { id: string; titulo: string }[]).find((t) => /historial/.test(normT(t.titulo)) && /(metatrader|mt5|mt4)/.test(normT(t.titulo))) ?? ((tutsMT ?? []) as { id: string; titulo: string }[]).find((t) => /descargar.*historial/.test(normT(t.titulo)));
  const consejos = n >= 15 ? generarConsejos(om, m, capital, { mp, pc }) : [];
  const setupsUsados = Array.from(new Set(todas.map((o) => o.setup).filter(Boolean) as string[]));
  const importadas = todas.filter((o) => o.origen === "mt5").length;
  const visibles = ops.slice(0, 100);
  const dec = (x: number | null, d = 2) => (x == null ? "—" : x.toLocaleString("es-PY", { maximumFractionDigits: d }));

  // Curva de resultado acumulado con ejes: montos a la izquierda, % del capital inicial a la derecha y fechas abajo.
  const W = 640, H = 250, ML = 66, MR = capital > 0 ? 62 : 16, MT = 14, MB = 34;
  const ymin = Math.min(0, ...m.curva), ymax = Math.max(0, ...m.curva);
  const rawStep = (ymax - ymin || 1) / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const frac = rawStep / pot;
  const paso = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pot;
  const t0 = Math.floor(ymin / paso) * paso, t1 = Math.ceil(ymax / paso) * paso;
  const ticks: number[] = [];
  for (let v = t0; v <= t1 + paso / 1000; v += paso) ticks.push(Math.round(v * 100) / 100);
  const px = (i: number) => ML + (m.curva.length > 1 ? i / (m.curva.length - 1) : 0) * (W - ML - MR);
  const py = (v: number) => MT + ((t1 - v) / (t1 - t0 || 1)) * (H - MT - MB);
  const puntos = m.curva.map((v, i) => px(i).toFixed(1) + "," + py(v).toFixed(1)).join(" ");
  const idxX = Array.from(new Set(Array.from({ length: 6 }, (_, k) => Math.round((k * (m.curva.length - 1)) / 5))));
  const fechaCorta = (f: string) => (f ? f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(2, 4) : "");
  const yTxt = (v: number) => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-PY", { maximumFractionDigits: 0 });
  const maxDia = Math.max(1, ...m.porDia.map((d) => Math.abs(d.neto)));

  // Calendario de resultados (PNL por día) del mes elegido, con todas las operaciones.
  const mesSel = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? searchParams.m! : hoy.slice(0, 7);
  const [cy, cm] = mesSel.split("-").map(Number);
  const diasMes = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const offIni = (new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const porDiaMes = new Map<number, { n: number; neto: number }>();
  for (const o of todas) {
    if (!o.fecha.startsWith(mesSel)) continue;
    const dnum = Number(o.fecha.slice(8, 10));
    const v = porDiaMes.get(dnum) ?? { n: 0, neto: 0 };
    v.n++; v.neto += Number(o.resultado);
    porDiaMes.set(dnum, v);
  }
  const celdas: (number | null)[] = [...Array(offIni).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  const totMes = Array.from(porDiaMes.values()).reduce((a, v) => a + v.neto, 0);
  const opsMes = Array.from(porDiaMes.values()).reduce((a, v) => a + v.n, 0);
  const diasGan = Array.from(porDiaMes.values()).filter((v) => v.neto > 0).length;
  const diasPer = Array.from(porDiaMes.values()).filter((v) => v.neto < 0).length;
  const maxAbs = Math.max(1, ...Array.from(porDiaMes.values()).map((v) => Math.abs(v.neto)));
  const desplazar = (d: number) => { const t = cy * 12 + (cm - 1) + d; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
  const qsMes = (mes: string) => { const q = new URLSearchParams(); if (searchParams.p) q.set("p", searchParams.p); if (searchParams.d) q.set("d", searchParams.d); if (searchParams.h) q.set("h", searchParams.h); q.set("m", mes); if (ver) q.set("alumno", alumnoId); return "/journal?" + q.toString(); };
  const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const corto = (x: number) => (x < 0 ? "-" : "") + "$" + Math.abs(x).toLocaleString("es-PY", { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 2 });
  const colorDia = (x: number) => (x > 0 ? "rgba(34,197,94," : "rgba(239,68,68,") + (0.12 + 0.4 * (Math.abs(x) / maxAbs)).toFixed(2) + ")";

  return (
    <>
      {ver && <Link href={"/accesos/" + alumnoId} className="back">← Volver a {duenio}</Link>}
      <h1>{ver ? "Journal de " + duenio : "Journal"}</h1>
      {ver
        ? <p className="alerta">Vista de administrador, solo lectura: aquí no se puede cargar, importar ni borrar nada. Cada consulta queda registrada.</p>
        : <p className="sub">Tu diario de trading: registra cada operación y mira tus estadísticas. Es personal; solo tú y el equipo de ELITE FX (para el seguimiento de tu mentoría) pueden verlo.</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      <div className="kp">
        <div className="box"><span className="mu">Operaciones</span><b>{n}</b></div>
        <div className="box"><span className="mu">% de aciertos</span><b>{n ? Math.round(m.tasa * 100) + "%" : "—"}</b>{n > 0 && <small className="mu" style={{ display: "block" }}>{m.ganadas} ganadoras de {n} operaciones</small>}</div>
        <div className="box"><span className="mu">Resultado neto</span><b className={m.neto < 0 ? "neg" : m.neto > 0 ? "pos" : ""}>{money(m.neto)}</b>{sub(m.neto)}</div>
        <div className="box"><span className="mu">Mejor / peor operación</span><b>{n ? money(m.mejor) + " / " + money(m.peor) : "—"}</b>{n > 0 && capital > 0 && <small className="mu" style={{ display: "block" }}>{pc(m.mejor)} / {pc(m.peor)} del capital inicial</small>}</div>
      </div>

      {!ver && <section className="box no-print">
        <form action={guardarCapital} className="fm" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ flex: 1, minWidth: 220 }}>Capital inicial de tu cuenta ($): es la base de todos los porcentajes
            <input name="capital" inputMode="decimal" defaultValue={capital > 0 ? String(capital) : ""} placeholder="Ej.: 10000" required />
          </label>
          <button className="btn s" style={{ marginBottom: 14 }}>Guardar capital</button>
        </form>
        {capital === 0 && <p className="mu" style={{ marginTop: 0 }}>Define tu capital inicial para ver cada monto también en porcentaje.</p>}
      </section>}
      {capital > 0 && <p className="mu">Referencias: los porcentajes de resultado son <b>sobre tu capital inicial de {money(capital)}</b>; el % de aciertos es sobre el total de operaciones; el drawdown es sobre el pico de capital.</p>}

      {!ver && <section className="box no-print">
        <h2>Importar reporte de MetaTrader 5</h2>
        <p className="mu">Sube el reporte de tu historial y se cargan todas tus operaciones y métricas de una vez. Si vuelves a subir el mismo reporte, no se duplican.</p>
        {videoMT && <p style={{ margin: "0 0 10px" }}><Link className="btn sd s" style={{ fontSize: 12, padding: "6px 12px", minHeight: 0 }} href={"/tutoriales?v=" + videoMT.id}>▶ ¿Cómo descargo el reporte? Ver video</Link></p>}
        <details>
          <summary>{videoMT ? "Prefiero leer los pasos" : "¿Cómo descargo el reporte desde MT5?"}</summary>
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
      </section>}

      {total > 0 && (
        <section className="box">
          <div className="hd" style={{ gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, textTransform: "capitalize" }}>Calendario de resultados · {NOMBRES_MES[cm - 1]} {cy}</h2>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <Link className="btn g s" href={qsMes(desplazar(-1))}>← Anterior</Link>
              {mesSel !== hoy.slice(0, 7) && <Link className="btn g s" href={qsMes(hoy.slice(0, 7))}>Hoy</Link>}
              <Link className="btn g s" href={qsMes(desplazar(1))}>Siguiente →</Link>
            </div>
          </div>
          <p className="mu">Resultado del mes: <b className={totMes < 0 ? "neg" : totMes > 0 ? "pos" : ""}>{mp(totMes)}</b> · {opsMes} operaciones · {diasGan} días en positivo · {diasPer} en negativo{capital > 0 ? " · porcentajes sobre tu capital inicial de " + money(capital) : ""}</p>
          <div className="calp">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="dn">{d}</div>)}
            <div className="dn">Semana</div>
            {semanas.map((sem, wi) => {
              const totSem = sem.reduce<number>((a, d) => a + (d ? porDiaMes.get(d)?.neto ?? 0 : 0), 0);
              const nSem = sem.reduce<number>((a, d) => a + (d ? porDiaMes.get(d)?.n ?? 0 : 0), 0);
              return (
                <div key={wi} style={{ display: "contents" }}>
                  {sem.map((d, i) => {
                    if (!d) return <div key={i} className="dc vacio" />;
                    const v = porDiaMes.get(d);
                    return (
                      <div key={i} className="dc" style={v ? { background: colorDia(v.neto) } : undefined} title={v ? v.n + " operaciones" : "Sin operaciones"}>
                        <span className="dd">{d}</span>
                        {v && <b className={v.neto < 0 ? "neg" : v.neto > 0 ? "pos" : ""}>{corto(v.neto)}</b>}
                        {v && <small className="mu">{capital > 0 ? pc(v.neto) : v.n + " op."}</small>}
                      </div>
                    );
                  })}
                  <div className="dc sem">
                    {nSem > 0 ? <><b className={totSem < 0 ? "neg" : "pos"}>{corto(totSem)}</b><small className="mu">{capital > 0 ? pc(totSem) : nSem + " op."}</small></> : <span className="mu">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {total > 0 && (
        <form method="get" className="box fm no-print" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          {ver && <input type="hidden" name="alumno" value={alumnoId} />}
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
            <div className="box"><span className="mu">Profit factor</span><b>{dec(m.pf)}</b><small className="mu" style={{ display: "block" }}>ganancias brutas ÷ pérdidas brutas</small></div>
            <div className="box"><span className="mu">Esperanza por operación</span><b className={m.esperanza < 0 ? "neg" : "pos"}>{money(m.esperanza)}</b>{sub(m.esperanza)}</div>
            <div className="box"><span className="mu">Ganancia / pérdida promedio</span><b>{money(m.promGanada)} / {money(m.promPerdida)}</b>{capital > 0 && <small className="mu" style={{ display: "block" }}>{pc(m.promGanada)} / {pc(m.promPerdida)} del capital inicial</small>}</div>
            <div className="box"><span className="mu">Ratio ganancia/pérdida</span><b>{dec(m.payoff)}</b><small className="mu" style={{ display: "block" }}>ganancia promedio ÷ pérdida promedio</small></div>
            <div className="box"><span className="mu">Drawdown máximo</span><b className="neg">{money(-m.ddMax)}</b>{capital > 0 && <small className="mu" style={{ display: "block" }}>-{((m.ddMax / (capital + m.ddPico)) * 100).toLocaleString("es-PY", { maximumFractionDigits: 2 })}% del pico de capital</small>}</div>
            <div className="box"><span className="mu">Racha máx. ganadoras / perdedoras</span><b>{m.rachaG} / {m.rachaP}</b></div>
          </div>

          <div className="cols">
            <section className="box">
              <h2>Curva de resultado</h2>
              <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto" }} role="img" aria-label="Resultado acumulado">
                {ticks.map((v) => (
                  <g key={v}>
                    <line x1={ML} x2={W - MR} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.45 : 0.12} strokeDasharray={v === 0 ? "5 4" : undefined} />
                    <text x={ML - 8} y={py(v) + 3.5} textAnchor="end" fontSize="10.5" fill="currentColor" fillOpacity=".75">{yTxt(v)}</text>
                    {capital > 0 && <text x={W - MR + 8} y={py(v) + 3.5} fontSize="10.5" fill="currentColor" fillOpacity=".75">{v === 0 ? "0%" : (v > 0 ? "+" : "") + ((v / capital) * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 }) + "%"}</text>}
                  </g>
                ))}
                {idxX.map((i) => (
                  <g key={i}>
                    <line x1={px(i)} x2={px(i)} y1={H - MB} y2={H - MB + 4} stroke="currentColor" strokeOpacity=".4" />
                    <text x={px(i)} y={H - MB + 17} textAnchor={i === 0 ? "start" : i === m.curva.length - 1 ? "end" : "middle"} fontSize="10.5" fill="currentColor" fillOpacity=".75">{fechaCorta(m.curvaFechas[i])}</text>
                  </g>
                ))}
                <polyline points={puntos} fill="none" stroke="var(--ac)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <small className="mu">Resultado acumulado en dólares (eje izquierdo){capital > 0 ? " y en % sobre tu capital inicial de " + money(capital) + " (eje derecho)" : ""}, operación por operación, del {fechaCorta(m.curvaFechas[0])} al {fechaCorta(m.curvaFechas[m.curvaFechas.length - 1])}.</small>
            </section>
            <section className="box">
              <h2>Por día de la semana</h2>
              {m.porDia.map((d) => (
                <div key={d.dia} style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
                  <span style={{ width: 34 }}>{d.dia}</span>
                  <div style={{ flex: 1, height: 10, background: "var(--sf2)", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round((Math.abs(d.neto) / maxDia) * 100) + "%", background: d.neto < 0 ? "var(--co)" : "var(--ac)" }} />
                  </div>
                  <span className={d.neto < 0 ? "neg" : "pos"} style={{ width: 150, textAlign: "right", fontSize: 13 }}>{d.n ? mp(d.neto) : "—"}</span>
                </div>
              ))}
            </section>
          </div>

          <section className="box">
            <h2>Recomendaciones para ti</h2>
            {n < 15 ? (
              <p className="mu">Carga al menos 15 operaciones (por ejemplo, importando tu reporte de MT5) para recibir recomendaciones personalizadas según tus horarios, pares, riesgo y disciplina.</p>
            ) : consejos.length === 0 ? (
              <p className="mu">Por ahora no hay patrones claros que corregir con los datos del período. Sigue cargando operaciones.</p>
            ) : (
              consejos.map((c, i) => (
                <div key={i} style={{ margin: "10px 0", padding: "10px 12px", borderRadius: 8, borderLeft: "4px solid " + (c.nivel === "alerta" ? "#ef4444" : c.nivel === "ok" ? "#22c55e" : "#f59e0b"), background: "rgba(127,127,127,.08)" }}>
                  <b>{c.nivel === "alerta" ? "⚠️ " : c.nivel === "ok" ? "✅ " : "💡 "}{c.titulo}</b>
                  <div style={{ marginTop: 4 }}>{c.texto}</div>
                </div>
              ))
            )}
            <small className="mu">Recomendaciones automáticas calculadas con tu propio historial (según el período elegido). Son una guía educativa, no una asesoría financiera; mientras más operaciones cargues, más confiables son. Los horarios usan la hora del servidor de tu broker.</small>
          </section>

          {frases.length > 0 && (
            <section className="box">
              <h2>Qué dicen tus números</h2>
              {frases.map((f, i) => <p key={i} style={{ margin: "6px 0" }}>• {f}</p>)}
            </section>
          )}
          <div className="cols">
            <Tabla titulo="Compras vs ventas" g={gDir} mp={mp} />
            <Tabla titulo="Por sesión" g={gSes} mp={mp} />
          </div>
          <div className="cols">
            <Tabla titulo="Por estrategia" g={gSet} mp={mp} />
            <Tabla titulo="Por estado emocional" g={gEmo} mp={mp} />
          </div>
          <Tabla titulo="Seguir o no tu plan" g={gPlan} mp={mp} />
          {gSes.length + gSet.length + gEmo.length + gPlan.length === 0 && <p className="mu no-print">Para ver más comparaciones (por sesión, estrategia, emoción y si seguiste tu plan), completa esos datos al anotar tus operaciones.</p>}

          <section className="box">
            <h2>Por par</h2>
            {m.porPar.slice(0, 12).map((x) => (
              <div key={x.par} className="ses">
                <div style={{ flex: 1 }}><b>{x.par}</b><small className="mu" style={{ display: "block" }}>{x.n} operaciones · {Math.round(x.tasa * 100)}% de aciertos</small></div>
                <span className={x.neto < 0 ? "neg" : "pos"}>{mp(x.neto)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      <div className={ver ? "no-print" : "cols no-print"}>
        {!ver && <section className="box">
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
        </section>}

        <section className="box">
          <details>
            <summary style={{ cursor: "pointer", fontSize: 18, fontWeight: 700 }}>{ver ? "Operaciones" : "Tus operaciones"} ({n}) — clic para desplegar</summary>
          {n === 0 && <p className="mu">Aún no registraste operaciones.</p>}
          {n > 100 && <p className="mu">Mostrando las últimas 100 de {n}.</p>}
          {visibles.map((o) => (
            <div key={o.id} className="ses">
              <div style={{ flex: 1 }}>
                <b>{o.par} · {o.direccion === "compra" ? "Compra" : "Venta"}</b>
                <small className="mu" style={{ display: "block" }}>{new Date(o.fecha + "T00:00:00").toLocaleDateString("es-PY")}{o.volumen ? " · " + o.volumen + " lotes" : ""}{o.origen === "mt5" ? " · MT5" : ""}{o.sesion ? " · " + o.sesion : ""}{o.setup ? " · " + o.setup : ""}{o.respeto_plan === false ? " · fuera del plan" : ""}{o.notas ? " · " + o.notas : ""}</small>
              </div>
              <span className={o.resultado < 0 ? "neg" : "pos"}>{mp(o.resultado)}</span>
              {!ver && <form action={borrarOperacion}>
                <input type="hidden" name="id" value={o.id} />
                <button className="btn g s">Eliminar</button>
              </form>}
            </div>
          ))}
          </details>
        </section>
      </div>
    </>
  );
}
