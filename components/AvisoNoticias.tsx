"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type N = { titulo: string; moneda: string; inicio: string };
const dos = (n: number) => String(n).padStart(2, "0");

// Aviso en Inicio: cuando falta una hora o menos para una noticia de alto impacto de las monedas elegidas, muestra su cuenta regresiva.
export default function AvisoNoticias({ noticias }: { noticias: N[] }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;
  const visibles = noticias
    .map((n) => ({ ...n, falta: Math.ceil((new Date(n.inicio).getTime() - ahora) / 1000) }))
    .filter((n) => n.falta <= 3600 && n.falta > -600)
    .slice(0, 3);
  if (visibles.length === 0) return null;
  return (
    <Link href="/noticias" className="box" style={{ display: "block", textDecoration: "none", color: "inherit", borderColor: "var(--go)", boxShadow: "inset 3px 0 0 var(--go)" }} role="status">
      <div className="tag" style={{ marginTop: 0 }}>Noticia de alto impacto</div>
      {visibles.map((n, i) => {
        const cerca = n.falta <= 300;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
            <b style={{ flex: 1, minWidth: 160 }}>{n.moneda} · {n.titulo}</b>
            {n.falta <= 0
              ? <span className="pill">● Publicándose ahora</span>
              : <span className="pill" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...(cerca ? { background: "var(--go)", color: "#14110a", borderColor: "var(--go)", fontWeight: 700 } : {}) }}>⏱ en {dos(Math.floor(n.falta / 60))}:{dos(n.falta % 60)}</span>}
          </div>
        );
      })}
      <small className="mu">Toca para ver el calendario de noticias</small>
    </Link>
  );
}
