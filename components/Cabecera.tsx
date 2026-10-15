"use client";
import { useState } from "react";
import Link from "next/link";
import { marcarLeidas } from "@/app/(app)/actions";

export type Notif = { id: string; titulo: string; cuerpo: string; enlace: string; fecha: string; nueva: boolean };

type Props = {
  nombre: string;
  email: string;
  iniciales: string;
  notifs: Notif[];
  noLeidas: number;
  onMenu: () => void;
};

export default function Cabecera({ nombre, email, iniciales, notifs, noLeidas, onMenu }: Props) {
  const [abierto, setAbierto] = useState<"" | "n" | "p">("");
  const cerrar = () => setAbierto("");
  return (
    <header className="top">
      <button className="hbg" aria-label="Abrir menú" onClick={onMenu}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <form action="/buscar" method="get" className="search" role="search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input type="search" name="q" placeholder="Buscar lecciones, tutoriales, sesiones…" aria-label="Buscar" />
      </form>

      <button className="ico" aria-label="Notificaciones" onClick={() => setAbierto(abierto === "n" ? "" : "n")}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
        </svg>
        {noLeidas > 0 && <span className="bdg">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>

      <button className="av" aria-label="Menú de perfil" aria-haspopup="menu" onClick={() => setAbierto(abierto === "p" ? "" : "p")}>
        {iniciales}
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
          <form action="/auth/salir" method="post">
            <button className="mi out2">Cerrar sesión</button>
          </form>
        </div>
      )}
    </header>
  );
}
