"use client";
import Link from "next/link";
import { useState, useTransition } from "react";

type L = { id: string; titulo: string; hecha: boolean };

// Lista de lecciones que el administrador puede reordenar arrastrando (o con las flechas ▲ ▼).
export default function ListaLeccionesAdmin({ cursoId, lecciones, actualId, guardar }: {
  cursoId: string; lecciones: L[]; actualId: string | null;
  guardar: (cursoId: string, ids: string[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [lista, setLista] = useState(lecciones);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pend, iniciar] = useTransition();

  function persistir(nueva: L[]) {
    const previa = lista;
    setLista(nueva);
    setMsg("Guardando orden…");
    iniciar(async () => {
      const r = await guardar(cursoId, nueva.map((x) => x.id));
      if (r.ok) setMsg("Orden guardado.");
      else { setLista(previa); setMsg("No se pudo guardar: " + (r.error ?? "")); }
    });
  }
  function mover(id: string, destino: number) {
    const i = lista.findIndex((x) => x.id === id);
    if (i < 0 || destino < 0 || destino >= lista.length || destino === i) return;
    const n = [...lista];
    const [it] = n.splice(i, 1);
    n.splice(destino, 0, it);
    persistir(n);
  }
  function soltar(destinoId: string) {
    if (arrastrando && arrastrando !== destinoId) mover(arrastrando, lista.findIndex((x) => x.id === destinoId));
    setArrastrando(null); setSobre(null);
  }

  return (
    <>
      <div className="lst">
        {lista.map((l, i) => (
          <div
            key={l.id}
            className={"lrow" + (sobre === l.id && arrastrando !== l.id ? " sobre" : "") + (arrastrando === l.id ? " arr" : "")}
            draggable
            onDragStart={(e) => { setArrastrando(l.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
            onDragOver={(e) => { e.preventDefault(); if (sobre !== l.id) setSobre(l.id); }}
            onDrop={(e) => { e.preventDefault(); soltar(l.id); }}
            onDragEnd={() => { setArrastrando(null); setSobre(null); }}
          >
            <span className="grip" aria-hidden="true" title="Arrastra para ordenar">⋮⋮</span>
            <Link href={"?l=" + l.id} className={l.id === actualId ? "li on" : "li"} draggable={false}>
              <span className="n">{l.hecha ? "✓" : i + 1}</span>
              <span>{l.titulo}</span>
            </Link>
            <span className="flechas">
              <button type="button" aria-label="Subir" disabled={i === 0 || pend} onClick={() => mover(l.id, i - 1)}>▲</button>
              <button type="button" aria-label="Bajar" disabled={i === lista.length - 1 || pend} onClick={() => mover(l.id, i + 1)}>▼</button>
            </span>
          </div>
        ))}
      </div>
      <small className="mu" style={{ display: "block", marginTop: 8 }}>{msg || "Arrastra las lecciones (⋮⋮) o usa las flechas para ordenarlas. Los alumnos ven este orden."}</small>
    </>
  );
}
