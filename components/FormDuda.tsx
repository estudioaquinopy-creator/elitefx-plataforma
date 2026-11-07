"use client";
import { useRef, useState } from "react";
import CajaTexto from "@/components/CajaTexto";
import BotonEnvio from "@/components/BotonEnvio";

type Resultado = { ok: boolean; error?: string };

// Formulario para preguntar (alumno) o responder (educador) debajo de una lección. Se vacía al enviar, sin recargar la página.
export default function FormDuda({ action, campos, placeholder, boton }: { action: (f: FormData) => Promise<Resultado>; campos: Record<string, string>; placeholder: string; boton: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  async function enviar(datos: FormData) {
    setError("");
    try {
      const r = await action(datos);
      if (r && !r.ok) { setError(r.error || "No se pudo enviar."); return; }
      ref.current?.reset();
    } catch {
      setError("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    }
  }
  return (
    <form ref={ref} action={enviar} className="fm resf">
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <CajaTexto name="cuerpo" rows={2} placeholder={placeholder} required maxLength={2000} />
      <BotonEnvio className="btn s" enviando="Enviando…">{boton}</BotonEnvio>
      {error && <small className="lkerr" role="alert">{error}</small>}
    </form>
  );
}
