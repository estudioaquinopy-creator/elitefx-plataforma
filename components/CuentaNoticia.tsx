"use client";
import { useEffect, useState } from "react";

const dos = (n: number) => String(n).padStart(2, "0");

// Cuenta regresiva de una noticia: aparece cuando falta una hora o menos y se actualiza cada segundo.
export default function CuentaNoticia({ inicio }: { inicio: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;
  const falta = Math.ceil((new Date(inicio).getTime() - ahora) / 1000);
  if (falta > 3600) return null;
  if (falta <= 0) return falta > -600 ? <span className="pill" style={{ whiteSpace: "nowrap" }}>● Publicándose ahora</span> : null;
  const muyCerca = falta <= 300;
  return (
    <span className="pill" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...(muyCerca ? { background: "var(--go)", color: "#14110a", borderColor: "var(--go)", fontWeight: 700 } : {}) }} title="Tiempo que falta para la noticia">
      ⏱ en {dos(Math.floor(falta / 60))}:{dos(falta % 60)}
    </span>
  );
}
