import Link from "next/link";
import ConfirmarEnvio from "@/components/ConfirmarEnvio";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estadoMembresia, perfilActual } from "@/lib/sesion";
import { cambiarPlan, cambiarRol, eliminarPersona, nuevaClave, fijarFecha, guardarAccesos, quitarCalendario, sumarCalendario } from "../actions";

export const dynamic = "force-dynamic";

const SECCIONES: [string, string][] = [["cursos", "Todos los cursos"], ["calendario", "Calendario (sesiones en vivo)"], ["tutoriales", "Tutoriales"], ["comunidad", "Comunidad"], ["journal", "Journal"], ["noticias", "Noticias"]];

export default async function Gestionar({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") notFound();
  const supabase = createClient();
  const { data: p } = await supabase.from("perfiles").select("*").eq("id", params.id).single();
  if (!p) notFound();
  const { data: acc } = await supabase.from("accesos").select("seccion, concedido").eq("user_id", params.id);
  const conc = new Set(((acc ?? []) as { seccion: string; concedido: boolean }[]).filter((a) => a.concedido).map((a) => a.seccion));
  const st = estadoMembresia(p);
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-PY");
  const nombre = p.nombre || p.email;

  // Aviso por WhatsApp según el estado de la membresía.
  const tel = String(p.telefono ?? "").replace(/\D/g, "");
  const texto = st.clave === "vencido"
    ? "Hola " + nombre + ", tu acceso al calendario de ELITE FX venció el " + (p.vence ? fmt(p.vence) : "") + ". ¿Quieres renovarlo?"
    : "Hola " + nombre + ", tu acceso al calendario de ELITE FX vence el " + (p.vence ? fmt(p.vence) : "") + ". ¿Quieres renovarlo?";
  const wa = tel ? "https://wa.me/" + tel + "?text=" + encodeURIComponent(texto) : "";

  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>{nombre}</h1>
      <p className="sub">{p.email}{p.telefono ? " · " + p.telefono : ""}</p>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      <div className="cols">
        <section className="box">
          <div className="hd"><h2>Membresía</h2><span className={"pill st-" + st.clave}>{st.texto}</span></div>
          <p className="mu">Vence: {p.vence ? fmt(p.vence) : "sin fecha de calendario"}</p>

          <form action={cambiarPlan} className="fm">
            <input type="hidden" name="id" value={p.id} />
            <label>Plan
              <select name="plan" defaultValue={p.plan}>
                <option value="gratis">Gratuito</option>
                <option value="live_trading">Live Trading</option>
                <option value="scanner">Scanner</option>
              </select>
            </label>
            <button className="btn g s">Guardar plan</button>
          </form>

          <div className="tag" style={{ marginTop: 18 }}>Calendario</div>
          <div className="acts">
            {[1, 2, 3].map((n) => (
              <form key={n} action={sumarCalendario}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="meses" value={n} />
                <button className="btn s">+{n} {n === 1 ? "mes" : "meses"}</button>
              </form>
            ))}
            <form action={quitarCalendario}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn d" style={{ marginTop: 0 }}>Quitar calendario</button>
            </form>
          </div>
          <form action={fijarFecha} className="fm" style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={p.id} />
            <label>O elige una fecha<input type="date" name="vence" defaultValue={p.vence ?? ""} /></label>
            <button className="btn g s" style={{ marginBottom: 14 }}>Fijar fecha</button>
          </form>

          {wa ? <a className="btn g s" href={wa} target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a> : <p className="mu">Sin teléfono registrado para avisar por WhatsApp.</p>}
        </section>

        <section className="box">
          <h2>Rol y contraseña</h2>
          <p className="mu">{p.rol === "admin" ? "Es administrador: ve y edita todo." : "Es alumno."}</p>
          <form action={cambiarRol} className="fm">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="rol" value={p.rol === "admin" ? "alumno" : "admin"} />
            <button className={p.rol === "admin" ? "btn d" : "btn g s"} style={{ marginTop: 0 }}>{p.rol === "admin" ? "Quitar rol de administrador" : "Hacer administrador"}</button>
          </form>
          <form action={nuevaClave} className="fm" style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={p.id} />
            <label>Nueva contraseña<input name="password" minLength={8} required placeholder="Mínimo 8 caracteres" /></label>
            <button className="btn g s" style={{ marginBottom: 14 }}>Cambiar contraseña</button>
          </form>

          <h2 style={{ marginTop: 22 }}>Accesos puntuales</h2>
          <p className="mu">Útil para dar acceso a algo concreto sin cambiar el plan (por ejemplo, a una persona gratuita).</p>
          <form action={guardarAccesos} className="fm">
            <input type="hidden" name="id" value={p.id} />
            {SECCIONES.map(([k, n]) => (
              <label key={k} className="ck"><input type="checkbox" name={k} defaultChecked={conc.has(k)} /> {n}</label>
            ))}
            <button className="btn s">Guardar accesos</button>
          </form>
        </section>
      </div>

      {p.id !== yo.id && (
        <section className="box" style={{ marginTop: 18 }}>
          <h2>Eliminar cuenta</h2>
          <p className="mu">Borra a {nombre} de la plataforma junto con su progreso, publicaciones y journal. No se puede deshacer.{p.rol === "admin" ? " Para eliminar a un administrador, primero quítale el rol." : ""}</p>
          <form action={eliminarPersona} className="fm">
            <input type="hidden" name="id" value={p.id} />
            <ConfirmarEnvio mensaje={"¿Eliminar definitivamente a " + nombre + "? No se puede deshacer."} className="btn elim">Eliminar cuenta</ConfirmarEnvio>
          </form>
        </section>
      )}
    </>
  );
}
