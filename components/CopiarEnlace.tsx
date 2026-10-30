"use client";
import { useState } from "react";

// Botón para copiar un texto (el enlace de referido) al portapapeles.
export default function CopiarEnlace({ texto, etiqueta = "Copiar enlace" }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch {
      window.prompt("Copia este texto:", texto);
    }
  }
  return <button type="button" className="btn bl s" onClick={copiar}>{ok ? "✓ Copiado" : etiqueta}</button>;
}
