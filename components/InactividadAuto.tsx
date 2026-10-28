"use client";
import { useEffect, useRef, useState } from "react";

const LIMITE = 30 * 60 * 1000;   // cierre de sesión por inactividad
const AVISO = 29 * 60 * 1000;    // aviso un minuto antes
const LATIDO = 4 * 60 * 1000;    // cada cuánto se avisa al servidor que la persona sigue activa

// Cierra la sesión tras 30 minutos sin actividad (mouse, teclado, scroll o toque). Un minuto antes avisa y permite seguir conectado.
export default function InactividadAuto() {
  const ultima = useRef(Date.now());
  const ultimoLatido = useRef(Date.now());
  const [aviso, setAviso] = useState(false);
  const [seg, setSeg] = useState(60);

  useEffect(() => {
    let cerrando = false;
    async function cerrar() {
      if (cerrando) return;
      cerrando = true;
      try { await fetch("/auth/salir", { method: "POST" }); } catch { /* se redirige igual */ }
      window.location.href = "/login?expirada=1";
    }
    function actividad() {
      ultima.current = Date.now();
      setAviso(false);
      if (Date.now() - ultimoLatido.current > LATIDO) {
        ultimoLatido.current = Date.now();
        fetch("/api/actividad", { cache: "no-store" }).then((r) => { if (r.redirected && r.url.includes("/login")) window.location.href = "/login?expirada=1"; }).catch(() => {});
      }
    }
    function revisar() {
      const idle = Date.now() - ultima.current;
      if (idle >= LIMITE) { cerrar(); return; }
      if (idle >= AVISO) { setAviso(true); setSeg(Math.max(0, Math.ceil((LIMITE - idle) / 1000))); }
    }
    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }));
    const t = setInterval(revisar, 1000);
    const vis = () => { if (document.visibilityState === "visible") revisar(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, actividad));
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  if (!aviso) return null;
  return (
    <div role="alertdialog" aria-live="assertive" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="box" style={{ maxWidth: 400, textAlign: "center", background: "var(--sf)" }}>
        <h2 style={{ marginTop: 0 }}>¿Sigues ahí?</h2>
        <p className="mu">Por seguridad, tu sesión se cerrará en <b>{seg} s</b> por inactividad.</p>
        <button className="btn sd" onClick={() => { ultima.current = Date.now(); setAviso(false); fetch("/api/actividad", { cache: "no-store" }).catch(() => {}); }}>Seguir conectado</button>
      </div>
    </div>
  );
}
