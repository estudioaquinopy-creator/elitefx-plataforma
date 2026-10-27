"use client";

// Botón de envío que pide confirmación antes de enviar el formulario.
export default function ConfirmarEnvio({ children, mensaje, className = "btn elim" }: { children: React.ReactNode; mensaje: string; className?: string }) {
  return (
    <button className={className} style={{ marginTop: 0 }} onClick={(e) => { if (!window.confirm(mensaje)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
