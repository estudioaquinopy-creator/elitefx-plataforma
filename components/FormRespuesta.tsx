"use client";
import { useRef, useState } from "react";
import CajaTexto from "@/components/CajaTexto";
import BotonEnvio from "@/components/BotonEnvio";

type Resultado = { ok: boolean; error?: string };

// Formulario para responder a una publicación. Envía la respuesta, vacía el cuadro y deja abierta la publicación con la respuesta ya publicada
// (sin redirigir: antes el botón se quedaba en "Enviando…" aunque la respuesta sí se guardaba).
export default function FormRespuesta({ action, id }: { action: (f: FormData) => Promise<Resultado>; id: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  async function enviar(datos: FormData) {
    setError("");
    try {
      const r = await action(datos);
      if (r && !r.ok) { setError(r.error || "No se pudo responder."); return; }
      ref.current?.reset();
    } catch {
      setError("No se pudo enviar la respuesta. Revisa tu conexión e intenta de nuevo.");
    }
  }
  return (
    <form ref={ref} action={enviar} className="fm resf">
      <input type="hidden" name="id" value={id} />
      <CajaTexto name="cuerpo" rows={1} placeholder="Escribe una respuesta…" required maxLength={1000} />
      <BotonEnvio className="btn g s" enviando="Enviando…">Responder</BotonEnvio>
      {error && <small className="lkerr" role="alert">{error}</small>}
    </form>
  );
}
