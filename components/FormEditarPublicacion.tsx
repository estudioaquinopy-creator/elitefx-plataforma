"use client";
import { useState } from "react";
import CajaTexto from "@/components/CajaTexto";
import BotonEnvio from "@/components/BotonEnvio";

type Resultado = { ok: boolean; error?: string };

// Editar el título y el texto de una publicación propia, sin salir de la publicación.
export default function FormEditarPublicacion({ action, id, titulo, cuerpo }: { action: (f: FormData) => Promise<Resultado>; id: string; titulo: string; cuerpo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  async function enviar(datos: FormData) {
    setError("");
    try {
      const r = await action(datos);
      if (r && !r.ok) { setError(r.error || "No se pudo guardar."); return; }
      setAbierto(false);
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    }
  }
  if (!abierto) return <button type="button" className="lk" onClick={() => setAbierto(true)}>Editar</button>;
  return (
    <form action={enviar} className="fm" style={{ flexBasis: "100%", marginTop: 8 }}>
      <input type="hidden" name="id" value={id} />
      <input name="titulo" defaultValue={titulo} placeholder="Título (opcional)" maxLength={140} />
      <CajaTexto name="cuerpo" rows={4} defaultValue={cuerpo} maxLength={5000} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <BotonEnvio className="btn s" enviando="Guardando…">Guardar cambios</BotonEnvio>
        <button type="button" className="lk" onClick={() => { setAbierto(false); setError(""); }}>Cancelar</button>
        {error && <small className="lkerr" role="alert">{error}</small>}
      </div>
    </form>
  );
}
