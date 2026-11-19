"use client";
import { useState, type ReactNode } from "react";
import CajaTexto from "./CajaTexto";
import BotonEnvio from "./BotonEnvio";
import SelectorImagenes from "./SelectorImagenes";

type Op = { value: string; label: string };

// Compositor de publicaciones al estilo Skool: barra simple que se despliega al tocarla.
export default function Compositor({ action, opciones, iniciales }: { action: (f: FormData) => void | Promise<void>; opciones: Op[]; iniciales: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" className="comp-bar" onClick={() => setAbierto(true)}>
        <span className="av2 s">{iniciales}</span>
        <span>Escribe algo para la comunidad…</span>
      </button>
    );
  }
  return (
    <form action={action} className="comp">
      <input name="titulo" className="comp-t" placeholder="Título (opcional)" maxLength={140} />
      <CajaTexto name="cuerpo" rows={3} placeholder="¿Qué quieres compartir? Tu resultado, una duda… (si es urgente, escribe #ayuda en una pregunta y el equipo recibe un aviso)" autoFocus />
      <div className="comp-f">
        <SelectorImagenes />
        <select name="canal" defaultValue={opciones.find((o) => o.value === "preguntas") ? "preguntas" : opciones[0].value} aria-label="Etiqueta">
          {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="comp-c" onClick={() => setAbierto(false)}>Cancelar</button>
        <BotonEnvio className="btn s comp-p" enviando="Publicando…">Publicar</BotonEnvio>
      </div>
    </form>
  );
}
