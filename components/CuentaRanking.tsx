"use client";
import { useEffect, useState } from "react";

const dos = (n: number) => String(n).padStart(2, "0");

// Cuenta regresiva hasta el cierre del ranking del mes (último viernes, 23:59 hora de Paraguay).
export default function CuentaRanking({ cierre }: { cierre: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = ahora === null ? null : Math.max(0, Math.floor((new Date(cierre).getTime() - ahora) / 1000));
  const d = total === null ? 0 : Math.floor(total / 86400);
  const h = total === null ? 0 : Math.floor((total % 86400) / 3600);
  const m = total === null ? 0 : Math.floor((total % 3600) / 60);
  const s = total === null ? 0 : total % 60;
  const ultimas = total !== null && total <= 86400;
  const caja = (n: number, et: string) => (
    <div style={{ textAlign: "center", minWidth: 58 }}>
      <b style={{ fontSize: 26, fontVariantNumeric: "tabular-nums", display: "block", lineHeight: 1.1, ...(ultimas ? { color: "var(--go)" } : {}) }}>{total === null ? "--" : dos(n)}</b>
      <small className="mu">{et}</small>
    </div>
  );
  if (total === 0) return <p style={{ margin: "6px 0 0" }}><b>⏱ El ranking cerró. ¡Gracias por participar!</b></p>;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0 10px" }} aria-label="Tiempo que falta para el cierre del ranking">
      {caja(d, d === 1 ? "día" : "días")}{caja(h, "horas")}{caja(m, "min")}{caja(s, "seg")}
    </div>
  );
}
