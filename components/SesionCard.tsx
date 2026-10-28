"use client";
import { useRef } from "react";

// Tarjeta de sesión del calendario: de color según el tipo; al tocarla se abre un flotante con los detalles.
export default function SesionCard({ titulo, inicio, zoom, color, tipo, extra }: {
  titulo: string; inicio: string; zoom: string; color: string; tipo: string; extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const d = new Date(inicio);
  const hora = d.toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false });
  const fecha = d.toLocaleDateString("es-PY", { timeZone: "America/Asuncion", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const abrir = () => { const x = ref.current; if (x && !x.open) x.showModal(); };
  return (
    <>
      <div className="sc" style={{ ["--c" as string]: color }} role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}>
        <div className="sh">{hora}</div>
        <b>{titulo}</b>
        {zoom && <a className="btn sd" href={zoom} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Unirme</a>}
      </div>
      <dialog ref={ref} className="pm sesm" style={{ ["--c" as string]: color }} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <button type="button" className="pm-x" onClick={() => ref.current?.close()} aria-label="Cerrar">✕</button>
        <span className="stipo">{tipo}</span>
        <h2 style={{ margin: "10px 0 14px" }}>{titulo}</h2>
        <p className="sdet"><b>Fecha</b><span style={{ textTransform: "capitalize" }}>{fecha}</span></p>
        <p className="sdet"><b>Hora</b><span>{hora} · horario de Paraguay</span></p>
        <p className="sdet"><b>Enlace</b>{zoom ? <a className="btn sd s" href={zoom} target="_blank" rel="noopener noreferrer">Unirme</a> : <span className="mu">Se publicará antes de la sesión</span>}</p>
        {extra}
      </dialog>
    </>
  );
}
