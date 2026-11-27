"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GrupoRedes } from "@/lib/redes";
import Cabecera, { type Notif } from "./Cabecera";

type Item = { href: string; label: string; lock: boolean; icon: string; soon?: string; aviso?: { texto: string; tipo: "ok" | "no" } };

type Props = { items: Item[]; nombre: string; email: string; iniciales: string; avatar?: string; notifs: Notif[]; noLeidas: number; real: boolean; vista: string; redes: GrupoRedes[]; editarRedes: boolean; enLinea?: React.ReactNode; children: React.ReactNode };

function IconoIg() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" />
    </svg>
  );
}

export default function Shell({ items, nombre, email, iniciales, avatar, notifs, noLeidas, real, vista, redes, editarRedes, enLinea, children }: Props) {
  const [open, setOpen] = useState(false);
  const [verRedes, setVerRedes] = useState(false);
  const lista = redes.flatMap((g) => g.items.map((r) => ({ g: g.grupo, ...r })));
  const path = usePathname();
  // Se resalta solo la sección más específica (así "Comunidad" no se marca cuando estás en "Ranking", que cuelga de /comunidad).
  const activo = items.filter((i) => !i.soon && (path === i.href || path.startsWith(i.href + "/"))).sort((x, y) => y.href.length - x.href.length)[0]?.href;
  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={open ? "side open" : "side"}>
        <div className="slogo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        {items.map((it) => it.soon ? (
          <div key={it.href} className="nav" aria-disabled="true" style={{ opacity: 0.55, cursor: "default" }} data-sec={it.href.slice(1)}>
            <span className="ni"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={it.icon} />
            </svg></span>
            <span className="nl" style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              {it.label}
              <small style={{ fontSize: 11, opacity: 0.8 }}>Desde el {it.soon}</small>
            </span>
          </div>
        ) : (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            title={it.label}
            aria-label={it.label}
            className={it.href === activo ? "nav on" : "nav"}
            data-sec={it.href.slice(1)}
          >
            <span className="ni"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={it.icon} />
            </svg></span>
            <span className="nl">{it.label}</span>
            {it.lock && <span className="pill">Miembros</span>}
            {it.aviso && <span className={it.aviso.tipo === "ok" ? "pill ok" : "pill st-vencido"} style={{ marginLeft: "auto" }}>{it.aviso.texto}</span>}
          </Link>
        ))}
        {(redes.length > 0 || editarRedes) && (
          <div className="redes" onMouseEnter={() => setVerRedes(true)} onMouseLeave={() => setVerRedes(false)}>
            {lista.length === 1 && (
              <a href={lista[0].url} target="_blank" rel="noopener noreferrer" className="ig" title={"Instagram · " + lista[0].g} aria-label={"Instagram · " + lista[0].g}><IconoIg /></a>
            )}
            {lista.length > 1 && (
              <>
                <button type="button" className="ig" title="Instagram" aria-label="Instagram" aria-expanded={verRedes} onClick={() => setVerRedes(!verRedes)}><IconoIg /></button>
                {verRedes && lista.map((r) => (
                  <a key={r.g + r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" className="ig igsub" title={"Instagram · " + r.g} aria-label={"Instagram · " + r.g}><IconoIg /></a>
                ))}
              </>
            )}
            {editarRedes && lista.length === 0 && <Link href="/redes" onClick={() => setOpen(false)} className="redit">+ Agregar redes sociales</Link>}
            {editarRedes && lista.length > 0 && verRedes && <Link href="/redes" onClick={() => setOpen(false)} className="redit" title="Editar redes" aria-label="Editar redes">✎</Link>}
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
