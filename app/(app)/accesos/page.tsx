import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estadoMembresia, perfilActual } from "@/lib/sesion";

export const dynamic = "force-dynamic";

type Fila = { id: string; nombre: string; email: string; plan: string; vence: string | null };
const POR_PAGINA = 40;
const PLAN_TXT: Record<string, string> = { gratis: "Gratuito", live_trading: "Live Trading", scanner: "Scanner" };
const ESTADOS = [["", "Todos"], ["activo", "Activo"], ["porvencer", "Por vencer"], ["vencido", "Vencido"], ["gratis", "Gratis"], ["sin", "Sin calendario"]];

export default async function Accesos({ searchParams }: { searchParams: { q?: string; e?: string; p?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const { data } = await createClient().from("perfiles").select("id, nombre, email, plan, vence").order("nombre");
  const todos = (data ?? []) as Fila[];
  const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(searchParams.q ?? "");
  const e = searchParams.e ?? "";
  const filtrados = todos.filter((f) => (!q || norm(f.nombre + " " + f.email).includes(q)) && (!e || estadoMembresia(f).clave === e));
  const pag = Math.max(1, Number(searchParams.p) || 1);
  const pagina = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const total = Math.ceil(filtrados.length / POR_PAGINA);
  const cuenta = (k: string) => todos.filter((f) => estadoMembresia(f).clave === k).length;
  const url = (p: number) => "/accesos?q=" + encodeURIComponent(searchParams.q ?? "") + "&e=" + e + "&p=" + p;

  return (
    <>
      <h1>Accesos y membresías</h1>
      <p className="sub">Da o quita acceso a tus alumnos y controla los vencimientos del calendario.</p>
      <div className="kp">
        <div className="box"><span className="mu">Alumnos</span><b>{todos.length}</b></div>
        <div className="box"><span className="mu">Activos</span><b>{cuenta("activo")}</b></div>
        <div className="box"><span className="mu">Por vencer (7 días)</span><b>{cuenta("porvencer")}</b></div>
        <div className="box"><span className="mu">Vencidos</span><b>{cuenta("vencido")}</b></div>
      </div>

      <form method="get" className="box fm" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label style={{ flex: 1, minWidth: 200 }}>Buscar por nombre o correo<input name="q" defaultValue={searchParams.q ?? ""} /></label>
        <label>Estado
          <select name="e" defaultValue={e}>{ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </label>
        <button className="btn s" style={{ marginBottom: 14 }}>Filtrar</button>
      </form>

      <section className="box">
        <h2>{filtrados.length} persona(s)</h2>
        {pagina.map((f) => {
          const st = estadoMembresia(f);
          return (
            <div key={f.id} className="ses">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{f.nombre || f.email}</b>
                <small className="mu" style={{ display: "block", overflowWrap: "anywhere" }}>{f.email} · {PLAN_TXT[f.plan]}{f.vence ? " · vence " + new Date(f.vence + "T00:00:00").toLocaleDateString("es-PY") : ""}</small>
              </div>
              <span className={"pill st-" + st.clave}>{st.texto}</span>
              <Link className="btn g s" href={"/accesos/" + f.id}>Gestionar</Link>
            </div>
          );
        })}
        {total > 1 && (
          <div className="pager">
            {pag > 1 && <Link href={url(pag - 1)}>← Anterior</Link>}
            <span className="mu">Página {pag} de {total}</span>
            {pag < total && <Link href={url(pag + 1)}>Siguiente →</Link>}
          </div>
        )}
      </section>
    </>
  );
}
