"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Tema from "@/components/Tema";
import { marcarLeidas, modoAlumno } from "@/app/(app)/actions";

// Teléfono: el buscador es solo una lupa que al tocarla se abre a todo el ancho; en escritorio no cambia nada.
const CSS_MOVIL = `
.search .lupa{background:none;border:0;padding:0;color:inherit;display:flex;cursor:default}
.search .x-bus{display:none}
@media(max-width:760px){
.search:not(.abre){flex:none;width:44px;padding:0;justify-content:center;margin-right:auto}
.search:not(.abre) .lupa{cursor:pointer;width:44px;height:44px;align-items:center;justify-content:center}
.search:not(.abre) input{display:none}
.search.abre{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);z-index:40;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.search.abre .x-bus{display:block;background:none;border:0;color:inherit;font-size:16px;cursor:pointer;padding:0 4px}
}`;

export type Notif = { id: string; titulo: string; cuerpo: string; enlace: string; fecha: string; nueva: boolean };

type Props = {
  nombre: string;
  email: string;
  iniciales: string;
  avatar?: string;
  notifs: Notif[];
  noLeidas: number;
  real: boolean;
  vista: string;
  enLinea?: React.ReactNode;
  onMenu: () => void;
};

export default function Cabecera({ nombre, email, iniciales, avatar, notifs, noLeidas, real, vista, enLinea, onMenu }: Props) {
  const [abierto, setAbierto] = useState<"" | "n" | "p">("");
  const cerrar = () => setAbierto("");
  const [buscar, setBuscar] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <header className="top">
      <button className="hbg" aria-label="Abrir menú" onClick={onMenu}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <style>{CSS_MOVIL}</style>
      <form action="/buscar" method="get" className={buscar ? "search abre" : "search"} role="search">
        <button type="button" className="lupa" aria-label="Buscar" onClick={() => { setBuscar(true); setTimeout(() => ref.current?.focus(), 30); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
        </button>
        <input ref={ref} type="search" name="q" placeholder="Buscar lecciones, tutoriales, sesiones…" aria-label="Buscar" />
        <button type="button" className="x-bus" aria-label="Cerrar búsqueda" onClick={() => setBuscar(false)}>✕</button>
      </form>

      {enLinea}

      <Tema />

      <button className="ico" aria-label="Notificaciones" onClick={() => setAbierto(abierto === "n" ? "" : "n")}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
        </svg>
        {noLeidas > 0 && <span className="bdg">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>

      <button className="av" aria-label="Menú de perfil" aria-haspopup="menu" onClick={() => setAbierto(abierto === "p" ? "" : "p")}>
        {avatar ? <img src={avatar} alt="" /> : iniciales}
      </button>

      {abierto && <div className="cierra" onClick={cerrar} />}

      {abierto === "n" && (
        <div className="drop nd">
          <div className="drop-h">
            <b>Notificaciones</b>
            {noLeidas > 0 && (
              <form action={marcarLeidas}>
                <button className="lk">Marcar como leídas</button>
              </form>
            )}
          </div>
          {notifs.length === 0 && <p className="mu" style={{ padding: 12, margin: 0 }}>No tienes notificaciones.</p>}
          {notifs.map((n) => (
            <Link key={n.id} href={n.enlace} onClick={cerrar} className={n.nueva ? "nitem nueva" : "nitem"}>
              <b>{n.titulo}</b>
              <small className="mu">{n.cuerpo}{n.cuerpo ? " · " : ""}{n.fecha}</small>
            </Link>
          ))}
          <Link href="/perfil?t=notif" onClick={cerrar} className="drop-f">Ver todas</Link>
        </div>
      )}

      {abierto === "p" && (
        <div className="drop dd" role="menu">
          <div className="drop-h" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <b>{nombre}</b>
            <small className="mu">{email}</small>
          </div>
          <Link href="/perfil?t=editar" onClick={cerrar} className="mi">Editar perfil</Link>
          <Link href="/perfil?t=clave" onClick={cerrar} className="mi">Cambiar contraseña</Link>
          <Link href="/perfil?t=notif" onClick={cerrar} className="mi">Notificaciones</Link>
          <Link href="/ayuda" onClick={cerrar} className="mi">Ayuda y soporte</Link>
          {real && (
            <form action={modoAlumno} className="mi" style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "default" }}>
              <label htmlFor="ver-como" style={{ fontSize: 12, opacity: 0.7 }}>Ver la plataforma como</label>
              <select id="ver-como" name="como" value={vista} onChange={(e) => e.currentTarget.form?.requestSubmit()} style={{ width: "100%" }}>
                <option value="">Administrador</option>
                <option value="gratis">Gratuito</option>
                <option value="alumno">Gratuito alumno</option>
                <option value="miembro">VIP</option>
              </select>
            </form>
          )}
          <form action="/auth/salir" method="post">
            <button className="mi out2">Cerrar sesión</button>
          </form>
        </div>
      )}
    </header>
  );
}
