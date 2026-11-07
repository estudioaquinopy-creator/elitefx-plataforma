"use client";
import { useEffect, useState } from "react";

// Imagen de una publicación: al tocarla se abre grande; dentro, tocar la imagen alterna entre ajustada y ampliada; Esc o fuera de la imagen la cierra.
export default function ImagenZoom({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  const [grande, setGrande] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setAbierta(false); setGrande(false); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [abierta]);
  function cerrar() { setAbierta(false); setGrande(false); }
  return (
    <>
      <img className={(className ?? "") + " zoomable"} src={src} alt={alt} onClick={() => setAbierta(true)} />
      {abierta && (
        <div className="zoom-fondo" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={cerrar}>
          <button type="button" className="zoom-x" onClick={cerrar} aria-label="Cerrar">✕</button>
          <div className={"zoom-caja" + (grande ? " grande" : "")}>
            <img src={src} alt={alt} className={grande ? "zoom-img grande" : "zoom-img"} onClick={(e) => { e.stopPropagation(); setGrande(!grande); }} />
          </div>
          <small className="zoom-ayuda">{grande ? "Toca la imagen para achicar" : "Toca la imagen para agrandar"}</small>
        </div>
      )}
    </>
  );
}
