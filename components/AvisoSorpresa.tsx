"use client";
import { useEffect, useState } from "react";

const dos = (n: number) => String(n).padStart(2, "0");

// Cabecera de Inicio: aviso con cuenta regresiva hasta una fecha. Pasada la hora, muestra "¡Llegó el momento!" durante 1 hora y luego desaparece.
export default function AvisoSorpresa({ texto, hasta, etiqueta }: { texto: string; hasta: string; etiqueta: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;
  const falta = Math.ceil((new Date(hasta).getTime() - ahora) / 1000);
  if (falta < -3600) return null;
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
        <h2 style={{ margin: "4px 0 2px" }}>{falta <= 0 ? "¡Llegó el momento de la sorpresa!" : texto}</h2>
        <small className="mu">{etiqueta}</small>
      </div>
      {falta > 0 && (
        <div style={{ display: "flex", gap: 10 }} aria-label="Tiempo que falta">
          {caja(d, d === 1 ? "día" : "días")}{caja(h, "horas")}{caja(m, "min")}{caja(s, "seg")}
        </div>
      )}
    </section>
  );
}
