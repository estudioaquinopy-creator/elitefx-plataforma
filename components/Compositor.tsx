"use client";
import { useState } from "react";
import CajaTexto from "./CajaTexto";
import BotonEnvio from "./BotonEnvio";

// Reduce la foto (máx. 1600 px, JPEG) antes de subirla: sube mucho más rápido y pesa una fracción.
async function achicar(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 300 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

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
      <input name="titulo" className="comp-t" placeholder="Título (opcional)" maxLength={140} />
      <CajaTexto name="cuerpo" rows={3} placeholder="¿Qué quieres compartir? Tu resultado, una duda…" autoFocus />
      <div className="comp-f">
        <label className="comp-i" title="Adjuntar imagen">
          🖼️ <span>{archivo || "Imagen"}</span>
          <input type="file" name="imagen" accept="image/*" hidden onChange={async (e) => {
            const inp = e.target; const f0 = inp.files?.[0];
            if (!f0) return setArchivo("");
            setArchivo("Preparando…");
            const f1 = await achicar(f0);
            const dt = new DataTransfer(); dt.items.add(f1); inp.files = dt.files;
            setArchivo(f1.name.slice(0, 18));
          }} />
        </label>
        <select name="canal" defaultValue={opciones.find((o) => o.value === "preguntas") ? "preguntas" : opciones[0].value} aria-label="Etiqueta">
          {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="comp-c" onClick={() => { setAbierto(false); setArchivo(""); }}>Cancelar</button>
        <BotonEnvio className="btn s comp-p" enviando="Publicando…">Publicar</BotonEnvio>
      </div>
    </form>
  );
}
