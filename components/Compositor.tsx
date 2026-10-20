"use client";
import { useState } from "react";
import CajaTexto from "./CajaTexto";

type Op = { value: string; label: string };

// Compositor de publicaciones al estilo Skool: barra simple que se despliega al tocarla.
export default function Compositor({ action, opciones, iniciales }: { action: (f: FormData) => void | Promise<void>; opciones: Op[]; iniciales: string }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState("");
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
      <CajaTexto name="cuerpo" rows={3} placeholder="¿Qué quieres compartir? Tu resultado, una duda…" autoFocus />
      <div className="comp-f">
        <label className="comp-i" title="Adjuntar imagen">
          🖼️ <span>{archivo || "Imagen"}</span>
          <input type="file" name="imagen" accept="image/*" hidden onChange={(e) => setArchivo(e.target.files?.[0]?.name.slice(0, 18) ?? "")} />
        </label>
        <select name="canal" defaultValue={opciones.find((o) => o.value === "preguntas") ? "preguntas" : opciones[0].value} aria-label="Etiqueta">
          {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="comp-c" onClick={() => { setAbierto(false); setArchivo(""); }}>Cancelar</button>
        <button className="btn s comp-p">Publicar</button>
      </div>
    </form>
  );
}
