"use client";
import { useFormStatus } from "react-dom";

// Botón de envío: mientras el formulario se procesa se bloquea y muestra un spinner (evita publicar dos veces).
export default function BotonEnvio({ children, enviando = "Enviando…", className = "btn s" }: { children: React.ReactNode; enviando?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className + (pending ? " cargando" : "")} disabled={pending} aria-busy={pending}>
      {pending && <span className="btn-spin" aria-hidden="true" />}
      {pending ? enviando : children}
    </button>
  );
}
