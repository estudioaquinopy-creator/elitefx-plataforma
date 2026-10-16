"use client";
import { useEffect, useState } from "react";

export default function Tema({ clase = "ico" }: { clase?: string }) {
  const [claro, setClaro] = useState(false);
  useEffect(() => { setClaro(document.documentElement.dataset.tema === "claro"); }, []);
  function alternar() {
    const n = !claro;
    setClaro(n);
    document.documentElement.dataset.tema = n ? "claro" : "oscuro";
    try { localStorage.setItem("tema", n ? "claro" : "oscuro"); } catch {}
  }
  return (
    <button type="button" className={clase} onClick={alternar} aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"} title={claro ? "Modo oscuro" : "Modo claro"}>
      {claro ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
    </button>
  );
}
