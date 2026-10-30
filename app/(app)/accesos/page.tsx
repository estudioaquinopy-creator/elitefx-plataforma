import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estadoMembresia, perfilActual } from "@/lib/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearPersona } from "./actions";
import AnclarJournal from "@/components/AnclarJournal";

export const dynamic = "force-dynamic";

type Fila = { id: string; nombre: string; email: string; plan: string; vence: string | null; rol: string };
const POR_PAGINA = 40;
const PLAN_TXT: Record<string, string> = { gratis: "Gratuito", live_trading: "VIP", scanner: "VIP" };
const CUENTAS = [["", "Todas"], ["pendiente", "Invitación pendiente"], ["sin", "Sin ingresar"], ["activa", "Activadas"]];
const CUENTA_TXT: Record<string, string> = { activa: "Activada", pendiente: "Invitación pendiente", sin: "Sin ingresar" };
const ESTADOS = [["", "Todos"], ["activo", "Activo"], ["porvencer", "Por vencer"], ["vencido", "Vencido"], ["gratis", "Gratis"], ["sin", "Sin calendario"]];

export default async function Accesos({ searchParams }: { searchParams: { q?: string; e?: string; c?: string; p?: string; ok?: string; error?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const { data } = await createClient().from("perfiles").select("id, nombre, email, plan, vence, rol").order("nombre");
  const todos = (data ?? []) as Fila[];
  // Estado de la cuenta (¿activó o solo tiene la invitación?) desde el sistema de acceso.
  const estadoCuenta: Record<string, string> = {};
  const adm = clienteAdmin();
  if (adm) {
    for (let pg = 1; pg <= 20; pg++) {
      const { data: lu } = await adm.auth.admin.listUsers({ page: pg, perPage: 1000 });
      const us = lu?.users ?? [];
      for (const u of us) estadoCuenta[u.id] = u.last_sign_in_at ? "activa" : u.invited_at ? "pendiente" : "sin";
      if (us.length < 1000) break;
    }
  }
  // Journals anclados por este administrador (acceso rápido).
  const { data: ancData } = await createClient().from("journals_anclados").select("alumno_id, created_at").eq("admin_id", perfil.id).order("created_at", { ascending: false });
  const anclados = ((ancData ?? []) as { alumno_id: string }[]).map((a) => todos.find((f) => f.id === a.alumno_id)).filter(Boolean) as Fila[];
  const cta = (f: Fila) => estadoCuenta[f.id] ?? "";
  const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(searchParams.q ?? "");
  const e = searchParams.e ?? "";
  const c = searchParams.c ?? "";
  const filtrados = todos.filter((f) => (!q || norm(f.nombre + " " + f.email).includes(q)) && (!e || estadoMembresia(f).clave === e) && (!c || cta(f) === c));
  const pag = Math.max(1, Number(searchParams.p) || 1);
  const pagina = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const total = Math.ceil(filtrados.length / POR_PAGINA);
  const cuenta = (k: string) => todos.filter((f) => estadoMembresia(f).clave === k).length;
  const clave = Array.from({ length: 10 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
  const url = (p: number) => "/accesos?q=" + encodeURIComponent(searchParams.q ?? "") + "&e=" + e + "&c=" + c + "&p=" + p;

  return (
    <>
      <h1>Accesos y membresías</h1>
      <p className="sub">Da o quita acceso a tus alumnos y controla los vencimientos del calendario.</p>
      <div className="kp">
        <div className="box"><span className="mu">Alumnos</span><b>{todos.length}</b></div>
        <div className="box"><span className="mu">Activos</span><b>{cuenta("activo")}</b></div>
        <div className="box"><span className="mu">Por vencer (7 días)</span><b>{cuenta("porvencer")}</b></div>
        <div className="box"><span className="mu">Vencidos</span><b>{cuenta("vencido")}</b></div>
        {adm && <div className="box"><span className="mu">Sin activar la cuenta</span><b>{todos.filter((f) => cta(f) === "pendiente" || cta(f) === "sin").length}</b></div>}
      </div>

      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      <p style={{ margin: "0 0 12px" }}><Link className="btn g s" href="/accesos/importar">Importar alumnos desde CSV</Link> <Link className="btn g s" href="/accesos/registro">Registro de acciones</Link></p>

      {anclados.length > 0 && (
        <section className="box">
          <h2>📌 Journals anclados</h2>
          {anclados.map((f) => (
            <div key={f.id} className="ses">
              <div style={{ flex: 1 }}><b>{f.nombre || f.email}</b><small className="mu" style={{ display: "block" }}>{f.email}</small></div>
              <Link className="btn s" href={"/journal?alumno=" + f.id}>📓 Ver journal</Link>
              <AnclarJournal alumnoId={f.id} anclado volver="/accesos" />
            </div>
          ))}
        </section>
      )}

      <details className="box adm">
        <summary>+ Agregar persona</summary>
        <form action={crearPersona} className="fm">
          <div className="f2">
            <label>Nombre<input name="nombre" placeholder="Nombre y apellido" /></label>
            <label>Correo<input type="email" name="email" required /></label>
          </div>
          <div className="f2">
            <label>Contraseña inicial (solo si no envías invitación)<input name="password" defaultValue={clave} minLength={8} /></label>
            <label>Teléfono (opcional, para WhatsApp)<input name="telefono" placeholder="595981123456" /></label>
          </div>
          <div className="f2">
            <label>Tipo de acceso
              <select name="tipo" defaultValue="gratis">
                <option value="gratis">Miembro gratuito</option>
                <option value="miembro">Miembro VIP</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label>Meses de acceso VIP (solo miembros VIP)
              <select name="meses" defaultValue="1">
                <option value="1">1 mes</option><option value="2">2 meses</option><option value="3">3 meses</option>
              </select>
            </label>
          </div>
          <label>O elige una fecha de vencimiento (opcional; reemplaza a los meses)<input type="date" name="vence" /></label>
          <label className="ck"><input type="checkbox" name="invitar" defaultChecked /> <span><b>Enviar invitación por correo</b> (recomendado): la persona recibe un mail y elige su propia contraseña. Desmárcalo para crearla con la contraseña inicial de arriba.</span></label>
          <button className="btn s">Crear persona</button>
        </form>
      </details>

      <form method="get" className="box fm" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label style={{ flex: 1, minWidth: 200 }}>Buscar por nombre o correo<input name="q" defaultValue={searchParams.q ?? ""} /></label>
        <label>Estado
          <select name="e" defaultValue={e}>{ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </label>
        {adm && (
          <label>Cuenta
            <select name="c" defaultValue={c}>{CUENTAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          </label>
        )}
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
                <small className="mu" style={{ display: "block", overflowWrap: "anywhere" }}>{f.email} · {f.rol === "admin" ? "Administrador · " : ""}{PLAN_TXT[f.plan]}{f.vence ? " · vence " + new Date(f.vence + "T00:00:00").toLocaleDateString("es-PY") : ""}</small>
              </div>
              {cta(f) && <span className={"pill " + (cta(f) === "activa" ? "st-activo" : "st-porvencer")}>{CUENTA_TXT[cta(f)]}</span>}
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
