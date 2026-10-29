"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GrupoRedes } from "@/lib/redes";
import Cabecera, { type Notif } from "./Cabecera";
import RankingLateral from "./RankingLateral";
import type { RankingLateral as DatosRanking } from "@/lib/rankingLateral";

type Item = { href: string; label: string; lock: boolean; icon: string };

type Props = { items: Item[]; nombre: string; email: string; iniciales: string; avatar?: string; notifs: Notif[]; noLeidas: number; real: boolean; vista: string; redes: GrupoRedes[]; editarRedes: boolean; ranking?: DatosRanking | null; enLinea?: React.ReactNode; children: React.ReactNode };

export default function Shell({ items, nombre, email, iniciales, avatar, notifs, noLeidas, real, vista, redes, editarRedes, ranking, enLinea, children }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={open ? "side open" : "side"}>
        <div className="slogo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={path === it.href || path.startsWith(it.href + "/") ? "nav on" : "nav"}
            data-sec={it.href.slice(1)}
          >
            <span className="ni"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={it.icon} />
            </svg></span>
            <span className="nl">{it.label}</span>
            {it.lock && <span className="pill">Miembros</span>}
          </Link>
        ))}
        {(redes.length > 0 || editarRedes || ranking) && (
          <div className="redes">
            {ranking && <RankingLateral d={ranking} alNavegar={() => setOpen(false)} />}
            {redes.flatMap((g) => g.items.map((r) => ({ g: g.grupo, ...r }))).map((r) => (
              <a key={r.g + r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" className="ig">
                <span className="igi">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r=".6" fill="#fff" />
                  </svg>
                </span>
                <span className="igt"><b>{r.g === "Marcos Aquino" ? "Sígueme" : "Síguenos"}</b><small>{r.nombre} · {r.g}</small></span>
              </a>
            ))}
            {editarRedes && <Link href="/redes" onClick={() => setOpen(false)} className="redit">{redes.length ? "Editar redes" : "+ Agregar redes sociales"}</Link>}
          </div>
        )}
      </aside>
      <main className="main" data-sec={path.split("/")[1] || ""}>
        <Cabecera nombre={nombre} email={email} iniciales={iniciales} avatar={avatar} notifs={notifs} noLeidas={noLeidas} real={real} vista={vista} enLinea={enLinea} onMenu={() => setOpen(!open)} />
        {children}
      </main>
    </div>
  );
}
