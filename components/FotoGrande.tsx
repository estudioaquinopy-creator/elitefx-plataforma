"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Foto de perfil que al tocarla se abre en grande (con el nombre debajo). Esc, ✕ o tocar fuera la cierra.
export default function FotoGrande({ src, nombre = "", style }: { src: string; nombre?: string; style?: React.CSSProperties }) {
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [abierta]);
  return (
    <>
      <img
        src={src}
        alt={nombre ? "Foto de " + nombre : ""}
        loading="lazy"
        title="Ver foto en grande"
        style={{ cursor: "zoom-in", ...style }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierta(true); }}
      />
      {abierta && typeof document !== "undefined" && createPortal(
        <div className="zoom-fondo" role="dialog" aria-modal="true" aria-label={"Foto de " + (nombre || "perfil")} onClick={() => setAbierta(false)}>
          <button type="button" className="zoom-x" onClick={() => setAbierta(false)} aria-label="Cerrar">✕</button>
          <img
            src={src}
            alt={nombre ? "Foto de " + nombre : "Foto de perfil"}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(86vw, 440px)", height: "min(86vw, 440px)", objectFit: "cover", borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,.5)", background: "#111" }}
          />
          {nombre && <b style={{ color: "#fff", marginTop: 12, fontSize: 17, textAlign: "center" }}>{nombre}</b>}
        </div>,
        document.body
      )}
    </>
  );
}
