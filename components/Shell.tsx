"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Cabecera, { type Notif } from "./Cabecera";

type Item = { href: string; label: string; lock: boolean; icon: string };

type Props = { items: Item[]; nombre: string; email: string; iniciales: string; notifs: Notif[]; noLeidas: number; real: boolean; vista: string; children: React.ReactNode };

export default function Shell({ items, nombre, email, iniciales, notifs, noLeidas, real, vista, children }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={open ? "side open" : "side"}>
        <div className="slogo">ELITE <span>FX</span></div>
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={path === it.href || path.startsWith(it.href + "/") ? "nav on" : "nav"}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={it.icon} />
            </svg>
            <span className="nl">{it.label}</span>
            {it.lock && <span className="pill">Miembros</span>}
          </Link>
        ))}
      </aside>
      <main className="main">
        <Cabecera nombre={nombre} email={email} iniciales={iniciales} notifs={notifs} noLeidas={noLeidas} real={real} vista={vista} onMenu={() => setOpen(!open)} />
        {children}
      </main>
    </div>
  );
}
