"use client";
import { useEffect, useState } from "react";
import CuentaNoticia from "./CuentaNoticia";

type Props = { hora: string; inicio: string; titulo: string; detalle: string; resultado?: string; pasadaServidor: boolean };

// Fila de una noticia: las que ya salieron se ven apagadas y las que faltan resaltan; se actualiza sola al pasar la hora.
export default function FilaNoticia({ hora, inicio, titulo, detalle, resultado, pasadaServidor }: Props) {
  const [pasada, setPasada] = useState(pasadaServidor);
  useEffect(() => {
    const revisar = () => setPasada(new Date(inicio).getTime() <= Date.now());
    revisar();
    const t = setInterval(revisar, 15000);
    return () => clearInterval(t);
  }, [inicio]);

  return (
    <div className="ses" style={pasada
      ? { opacity: 0.55, filter: "grayscale(.6)" }
      : { background: "var(--sf2)", borderRadius: 12, padding: "12px 12px", margin: "6px 0", borderBottom: 0, boxShadow: "inset 3px 0 0 var(--go)" }}>
      <div className="dt">{hora}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{titulo}</b>
        <small className="mu" style={{ display: "block" }}>{detalle}</small>
        {pasada && resultado && <small style={{ display: "block", marginTop: 2 }}><b>Resultado: {resultado}</b></small>}
      </div>
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {pasada ? <span className="pill">✓ Ya salió</span> : <CuentaNoticia inicio={inicio} />}
        <span className="pill st-vencido">Alto impacto</span>
      </span>
    </div>
  );
}
