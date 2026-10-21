import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import FotoPerfil from "@/components/FotoPerfil";
import { cambiarClave, guardarPerfil } from "./actions";

export const dynamic = "force-dynamic";

export default async function PerfilPage({ searchParams }: { searchParams: { t?: string; ok?: string; error?: string } }) {
  const perfil = await perfilActual();
  const t = searchParams.t === "clave" || searchParams.t === "notif" ? searchParams.t : "editar";
  const { data } = await createClient().from("notificaciones").select("*").order("created_at", { ascending: false }).limit(50);
  const lista = (data ?? []) as { id: string; titulo: string; cuerpo: string; enlace: string | null; created_at: string }[];
  const tabs = [["editar", "Editar perfil"], ["clave", "Cambiar contraseña"], ["notif", "Notificaciones"]];
  return (
    <>
      <h1>Mi perfil</h1>
      <p className="sub">{perfil.email}</p>
      <div className="tabs">
        {tabs.map(([k, n]) => (
          <Link key={k} href={"/perfil?t=" + k} className={t === k ? "tab on" : "tab"}>{n}</Link>
        ))}
      </div>
      {searchParams.ok && <p className="okmsg">{searchParams.ok}</p>}
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {t === "editar" && (
        <section className="box" style={{ maxWidth: 520 }}>
          <FotoPerfil uid={perfil.id} url={perfil.avatar_url ?? null} iniciales={((perfil.nombre || perfil.email).trim()[0] || "?").toUpperCase()} />
        </section>
      )}
      {t === "editar" && (
        <form action={guardarPerfil} className="box fm" style={{ maxWidth: 520 }}>
          <label>Nombre completo<input name="nombre" defaultValue={perfil.nombre} required /></label>
          <label>Teléfono / WhatsApp<input name="telefono" defaultValue={perfil.telefono ?? ""} /></label>
          <label>Correo<input value={perfil.email} disabled readOnly /></label>
          <button className="btn s">Guardar cambios</button>
        </form>
      )}
      {t === "clave" && (
        <form action={cambiarClave} className="box fm" style={{ maxWidth: 520 }}>
          <label>Nueva contraseña<input type="password" name="clave" minLength={8} required autoComplete="new-password" /></label>
          <label>Repite la contraseña<input type="password" name="clave2" minLength={8} required autoComplete="new-password" /></label>
          <button className="btn s">Cambiar contraseña</button>
        </form>
      )}
      {t === "notif" && (
        <section className="box">
          <h2>Tus notificaciones</h2>
          {lista.length === 0 && <p className="mu">Todavía no tienes notificaciones.</p>}
          {lista.map((n) => (
            <Link key={n.id} href={n.enlace || "/inicio"} className="nitem">
              <b>{n.titulo}</b>
              <small className="mu">{n.cuerpo} · {new Date(n.created_at).toLocaleDateString("es-PY")}</small>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
