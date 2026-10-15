"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; lock: boolean; icon: string };

export default function Shell({ items, nombre, children }: { items: Item[]; nombre: string; children: React.ReactNode }) {
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
        <header className="top">
          <button className="hbg" aria-label="Abrir menú" onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="who">{nombre}</span>
          <form action="/auth/salir" method="post">
            <button className="out">Cerrar sesión</button>
          </form>
        </header>
        {children}
      </main>
    </div>
  );
}
