import Link from "next/link";
import { cookies } from "next/headers";
import { hoyPY, ZONA, perfilActual, permisos } from "@/lib/sesion";
import FiltroMonedas from "@/components/FiltroMonedas";
import CuentaNoticia from "@/components/CuentaNoticia";
import SimuladorNoticia from "@/components/SimuladorNoticia";

export const dynamic = "force-dynamic";

type Ev = { title: string; country: string; date: string; impact: string; forecast: string; previous: string };
// Monedas disponibles en el filtro y las que se muestran por defecto (las que opera la academia).
const TODAS = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
const POR_DEFECTO = ["USD", "EUR", "GBP", "CAD"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const diaPY = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaPY = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

async function cargar(url: string): Promise<Ev[] | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j as Ev[]) : null;
  } catch { return null; }
}

export default async function Noticias({ searchParams }: { searchParams: { d?: string } }) {
  const perm = await permisos(await perfilActual());
  if (!perm.noticias) {
    return (
      <>
        <h1>Noticias</h1>
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">El calendario de noticias es para miembros.</p><Link className="btn sd" href="/ayuda">Quiero ser miembro</Link></section>
      </>
    );
  }
  const [esta, proxima] = await Promise.all([
    cargar("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
    cargar("https://nfs.faireconomy.media/ff_calendar_nextweek.json"),
  ]);
  const hoy = hoyPY();
  const guardadas = (cookies().get("noticias_monedas")?.value ?? "").split(/[.,]/).filter((m) => TODAS.includes(m));
  const MONEDAS = guardadas.length ? TODAS.filter((m) => guardadas.includes(m)) : POR_DEFECTO;

  if (!esta && !proxima) {
    return (
      <>
        <h1>Noticias</h1>
        <p className="sub">Noticias de alto impacto · horario de Paraguay.</p>
        <section className="box"><p className="mu">No se pudo cargar el calendario económico en este momento. Intenta de nuevo en unos minutos.</p></section>
      </>
    );
  }

  const evs = [...(esta ?? []), ...(proxima ?? [])].filter((e) => e.impact === "High" && MONEDAS.includes(e.country));
  const porDia = new Map<string, Ev[]>();
  for (const e of evs) porDia.set(diaPY(e.date), [...(porDia.get(diaPY(e.date)) ?? []), e]);
  for (const l of porDia.values()) l.sort((a, b) => a.date.localeCompare(b.date));

  // Días hábiles cubiertos por el calendario (lunes a viernes de las semanas cargadas).
  const todas = [...(esta ?? []), ...(proxima ?? [])].map((e) => diaPY(e.date)).sort();
  const ini = todas[0], fin = todas[todas.length - 1];
  const dias: string[] = [];
  for (let t = new Date(ini + "T12:00:00Z"); t.toISOString().slice(0, 10) <= fin; t = new Date(t.getTime() + 86400000)) {
    const f = t.toISOString().slice(0, 10), w = t.getUTCDay();
    if (w !== 0 && w !== 6) dias.push(f);
  }
  const sel = dias.includes(searchParams.d ?? "") ? (searchParams.d as string) : dias.includes(hoy) ? hoy : dias.find((d) => d >= hoy) ?? dias[0];
  const i = dias.indexOf(sel);
  const lista = porDia.get(sel) ?? [];
  const [y, m, d] = sel.split("-").map(Number);
  const nombre = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

  return (
    <>
      <h1>Noticias</h1>
      <p className="sub">Noticias de alto impacto · horario de Paraguay. Elige las monedas que quieres seguir.</p>

      <section className="box">
        <FiltroMonedas todas={TODAS} activas={MONEDAS} dia={sel} />
        <div className="calnav">
          {i > 0 ? <Link href={"/noticias?d=" + dias[i - 1]} aria-label="Día anterior">←</Link> : <span />}
          <b>{nombre} {d} de {MESES[m - 1]}</b>
          {i < dias.length - 1 ? <Link href={"/noticias?d=" + dias[i + 1]} aria-label="Día siguiente">→</Link> : <span />}
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {dias.map((f) => (
            <Link key={f} href={"/noticias?d=" + f} className={f === sel ? "chip on" : "chip"}>
              {DIAS[new Date(f + "T12:00:00Z").getUTCDay()].slice(0, 3)} {Number(f.slice(8, 10))}{porDia.has(f) ? " · " + porDia.get(f)!.length : ""}
            </Link>
          ))}
        </div>

        {lista.length === 0 && <p className="mu">No hay noticias de alto impacto este día para las monedas elegidas.</p>}
        {lista.map((e, k) => (
          <div key={k} className="ses">
            <div className="dt">{horaPY(e.date)}</div>
            <div style={{ flex: 1 }}>
              <b>{e.title}</b>
              <small className="mu" style={{ display: "block" }}>
                {e.country === "USD" ? "USD · afecta también al oro" : e.country}
                {e.forecast ? " · Previsión " + e.forecast : ""}{e.previous ? " · Anterior " + e.previous : ""}
              </small>
            </div>
            <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><CuentaNoticia inicio={e.date} /><span className="pill st-vencido">Alto impacto</span></span>
          </div>
        ))}
      </section>
      {perm.admin && (
        <details className="box adm">
          <summary>Simulador del contador (solo administrador)</summary>
          <SimuladorNoticia />
        </details>
      )}
      <p className="note">Fuente: calendario económico de Forex Factory (datos de terceros, pueden cambiar). Verifica siempre en tu plataforma antes de operar.</p>
    </>
  );
}
