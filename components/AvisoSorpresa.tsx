"use client";
import { useEffect, useState } from "react";

const dos = (n: number) => String(n).padStart(2, "0");

type Precio = { nombre: string; antes: string; ahora: string; gs: string };
type Anuncio = { titulo: string; motivo: string; vigencia: string; precios: Precio[]; nota: string; visibleDias: number };

// Cabecera de Inicio: cuenta regresiva hasta una fecha. Al llegar la hora muestra el anuncio (precios nuevos) durante `visibleDias` días y luego desaparece.
export default function AvisoSorpresa({ texto, hasta, etiqueta, anuncio, linkVip }: { texto: string; hasta: string; etiqueta: string; anuncio: Anuncio; linkVip?: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;
  const falta = Math.ceil((new Date(hasta).getTime() - ahora) / 1000);
  if (falta < -anuncio.visibleDias * 86400) return null;

  if (falta <= 0) {
    return (
      <section className="box" role="status" style={{ borderColor: "var(--go)", boxShadow: "inset 3px 0 0 var(--go)", marginBottom: 18 }}>
        <div className="tag" style={{ marginTop: 0 }}>🎉 ¡Llegó la sorpresa!</div>
        <h2 style={{ margin: "4px 0 6px" }}>{anuncio.titulo}</h2>
        <p style={{ margin: "0 0 12px" }}>{anuncio.motivo}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {anuncio.precios.map((p) => (
            <div key={p.nombre} style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 14, padding: "14px 16px" }}>
              <b>{p.nombre}</b>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                <span className="mu" style={{ textDecoration: "line-through" }}>{p.antes}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: "var(--go)", lineHeight: 1.1 }}>{p.ahora}</span>
              </div>
              <small className="mu">{p.gs}</small>
            </div>
          ))}
        </div>
        <p style={{ margin: "12px 0 0" }}><b>📅 {anuncio.vigencia}</b></p>
        {anuncio.nota && <small className="mu" style={{ display: "block", marginTop: 6 }}>{anuncio.nota}</small>}
        {linkVip && <a className="btn sd s" href={linkVip} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10 }}>Quiero aprovecharlo</a>}
      </section>
    );
  }

  const d = Math.floor(falta / 86400), h = Math.floor((falta % 86400) / 3600), m = Math.floor((falta % 3600) / 60), s = falta % 60;
  const caja = (n: number, et: string) => (
    <div style={{ textAlign: "center", minWidth: 58 }}>
      <b style={{ fontSize: 28, fontVariantNumeric: "tabular-nums", display: "block", lineHeight: 1.1, color: "var(--go)" }}>{dos(n)}</b>
      <small className="mu">{et}</small>
    </div>
  );
  return (
    <section className="box" role="status" style={{ borderColor: "var(--go)", boxShadow: "inset 3px 0 0 var(--go)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="tag" style={{ marginTop: 0 }}>🎁 Muy pronto</div>
        <h2 style={{ margin: "4px 0 2px" }}>{texto}</h2>
        <small className="mu">{etiqueta}</small>
      </div>
      <div style={{ display: "flex", gap: 10 }} aria-label="Tiempo que falta">
        {caja(d, d === 1 ? "día" : "días")}{caja(h, "horas")}{caja(m, "min")}{caja(s, "seg")}
      </div>
    </section>
  );
}
