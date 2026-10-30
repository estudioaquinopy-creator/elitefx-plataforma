import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { revisarLiquid } from "../actions";
import SubirCsvLiquid from "@/components/SubirCsvLiquid";

export const dynamic = "force-dynamic";

type Fila = { id: string; mes?: string; user_id: string; cuenta: string; estado: string; enviado_at: string; revisado_at: string | null; nota: string; reward?: number };

// El administrador comprueba en el panel de Liquid que el ID es cliente nuestro y lo aprueba o rechaza.
export default async function Liquid({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") notFound();
  const sb = createClient();
  const { data } = await sb.from("liquid_cuentas").select("*").order("enviado_at", { ascending: false }).limit(300);
  const filas = (data ?? []) as Fila[];
  const { count: guardadas } = await sb.from("liquid_csv").select("cuenta", { count: "exact", head: true });
  const { data: ult } = await sb.from("liquid_csv").select("visto_at").order("visto_at", { ascending: false }).limit(1).maybeSingle();
  const { data: ps } = await sb.from("perfiles").select("id, nombre, email, plan").in("id", filas.map((f) => f.user_id).concat(["00000000-0000-0000-0000-000000000000"]));
  const quien = new Map(((ps ?? []) as { id: string; nombre: string; email: string; plan: string }[]).map((p) => [p.id, p]));
  const fecha = (d: string) => new Date(d).toLocaleDateString("es-PY", { timeZone: "America/Asuncion" });
  const pendientes = filas.filter((f) => f.estado === "pendiente");
  const resto = filas.filter((f) => f.estado !== "pendiente");

  const Tarjeta = ({ f }: { f: Fila }) => {
    const p = quien.get(f.user_id);
    return (
      <div className="ses" style={{ flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{p?.nombre || p?.email || "—"}</b>{p && p.plan === "gratis" && <span className="pill" style={{ marginLeft: 8 }}>Gratis</span>}
          <small className="mu" style={{ display: "block" }}>{p?.email} · enviado {fecha(f.enviado_at)}{f.mes ? " (mes " + f.mes + ")" : ""}</small>
          <small style={{ display: "block" }}>Cuenta de Liquid: <b>{f.cuenta}</b></small>
          {f.estado === "aprobado" && <small className="mu" style={{ display: "block" }}>{Number(f.reward) > 0 ? "Opera en real (reward " + f.reward + ")" : "Sin operar en real todavía"}</small>}
          {f.estado !== "pendiente" && <small className="mu" style={{ display: "block" }}>{f.estado === "aprobado" ? "Aprobado" : "Rechazado"}{f.revisado_at ? " el " + fecha(f.revisado_at) : ""}{f.nota ? " · " + f.nota : ""}</small>}
        </div>
        <form action={revisarLiquid} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="id" value={f.id} />
          <input name="nota" placeholder="Nota (opcional)" maxLength={200} style={{ width: 160 }} />
          {f.estado !== "aprobado" && <button className="btn s" name="decision" value="aprobar">Aprobar</button>}
          {f.estado !== "rechazado" && <button className="btn g s" name="decision" value="rechazar">Rechazar</button>}
        </form>
      </div>
    );
  };

  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>Cuentas de Liquid</h1>
      <p className="sub">Compara el número de cuenta con el reporte de clientes de Liquid (CSV) para confirmar que es cliente nuestro (creó su cuenta con nuestro enlace) y apruébalo para que sume sus puntos en el ranking.</p>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      <section className="box">
        <h2>Aprobar con el CSV de Liquid</h2>
        <p className="mu">Sube cada día el CSV actualizado de tus clientes: las cuentas pendientes cuyo número aparezca en la columna "account" se aprueban solas y suman sus puntos; y las cuentas aprobadas cuya columna "reward" sea mayor a 0 (operan en real) suman los puntos extra. Las que no aparezcan quedan pendientes para revisarlas a mano.</p>
        <p className="mu">Los datos de cada CSV <b>quedan guardados</b> y se suman a los anteriores: {guardadas ?? 0} cuentas en la base{ult ? " (última actualización " + new Date((ult as { visto_at: string }).visto_at).toLocaleDateString("es-PY", { timeZone: "America/Asuncion" }) + ")" : ""}. Así se compara también con las cuentas que la gente registró antes o después, y quien registra una cuenta que ya está guardada se confirma al instante. Si una cuenta alguna vez tuvo reward mayor a 0, se recuerda.</p>
        <SubirCsvLiquid />
      </section>
      <section className="box">
        <h2>Pendientes ({pendientes.length})</h2>
        {pendientes.length === 0 && <p className="mu">No hay cuentas por revisar.</p>}
        {pendientes.map((f) => <Tarjeta key={f.id} f={f} />)}
      </section>
      {resto.length > 0 && (
        <section className="box">
          <h2>Ya revisados</h2>
          {resto.map((f) => <Tarjeta key={f.id} f={f} />)}
        </section>
      )}
    </>
  );
}
