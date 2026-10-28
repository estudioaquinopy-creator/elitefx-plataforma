"use client";
import { useEffect, useRef, useState } from "react";

const ANTES_MS = 5 * 60 * 1000; // el botón de unirse aparece 5 minutos antes de la sesión

// Tarjeta de sesión del calendario: de color según el tipo; al tocarla se abre un flotante con los detalles.
export default function SesionCard({ titulo, inicio, duracion = 90, zoom, color, tipo, extra }: {
  titulo: string; inicio: string; duracion?: number; zoom: string; color: string; tipo: string; extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const d = new Date(inicio);
  // Reloj del navegador (null hasta montar, para que el botón nunca aparezca de antemano).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const t0 = d.getTime();
  const puedeUnirse = !!zoom && ahora !== null && ahora >= t0 - ANTES_MS && ahora < t0 + duracion * 60000;
  const hora = d.toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false });
  const fecha = d.toLocaleDateString("es-PY", { timeZone: "America/Asuncion", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const abrir = () => { const x = ref.current; if (x && !x.open) x.showModal(); };
  return (
    <>
      <div className="sc" style={{ ["--c" as string]: color }} role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}>
        <div className="sh">{hora}</div>
        <b>{titulo}</b>
        {puedeUnirse && <a className="btn sd" href={zoom} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Unirme</a>}
      </div>
      <dialog ref={ref} className="pm sesm" style={{ ["--c" as string]: color }} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <button type="button" className="pm-x" onClick={() => ref.current?.close()} aria-label="Cerrar">✕</button>
        <span className="stipo">{tipo}</span>
        <h2 style={{ margin: "10px 0 14px" }}>{titulo}</h2>
        <p className="sdet"><b>Fecha</b><span style={{ textTransform: "capitalize" }}>{fecha}</span></p>
        <p className="sdet"><b>Hora</b><span>{hora} · horario de Paraguay</span></p>
        <p className="sdet"><b>Enlace</b>{!zoom ? <span className="mu">Se publicará antes de la sesión</span> : puedeUnirse ? <a className="btn sd s" href={zoom} target="_blank" rel="noopener noreferrer">Unirme</a> : ahora !== null && ahora >= t0 + duracion * 60000 ? <span className="mu">La sesión ya terminó</span> : <span className="mu">El botón para unirte aparece 5 minutos antes de la sesión</span>}</p>
        {extra}
      </dialog>
    </>
  );
}
