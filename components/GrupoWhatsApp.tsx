"use client";

import { useEffect, useState } from "react";
import { marcarGrupoWa } from "@/app/(app)/actions";
import { GRUPO_WHATSAPP_URL } from "@/lib/grupoWhatsapp";

// Ventana que invita al grupo de WhatsApp. "Ahora no" / ✕ la cierran solo en esta sesión del navegador;
// "Unirme al grupo" la quita para siempre (se guarda en la cuenta). `guardar` = false en el modo "ver como" del administrador.
export default function GrupoWhatsApp({ guardar }: { guardar: boolean }) {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("gwa_cerrado") === "1") return; } catch { /* sin almacenamiento */ }
    setVer(true);
  }, []);
  if (!ver) return null;
  const cerrar = () => {
    try { sessionStorage.setItem("gwa_cerrado", "1"); } catch { /* sin almacenamiento */ }
    setVer(false);
  };
  const unirme = () => {
    if (guardar) { marcarGrupoWa().catch(() => {}); }
    setVer(false);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gwa-t" style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,.55)" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 440, background: "var(--sf)", color: "var(--tx)", borderRadius: 24, padding: "30px 26px 22px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <button type="button" aria-label="Cerrar" onClick={cerrar} style={{ position: "absolute", right: 14, top: 10, background: "none", border: 0, color: "var(--mu)", fontSize: 20, cursor: "pointer", padding: 6 }}>✕</button>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#25d366", margin: "0 auto 14px", display: "grid", placeItems: "center" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 .9c.3.1.5.2.6.3.1.2.1.8-.1 1.4z" /></svg>
        </div>
        <h2 id="gwa-t" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>Únete al grupo de la Ruta del Trader</h2>
        <p style={{ margin: "0 0 20px", color: "var(--mu)", fontSize: 15, lineHeight: 1.5 }}>Entra a nuestro grupo de WhatsApp y mantente al día con la academia.</p>
        <a href={GRUPO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={unirme} style={{ display: "block", background: "#25d366", color: "#04130c", fontWeight: 700, fontSize: 16, padding: 14, borderRadius: 14, textDecoration: "none" }}>Unirme al grupo</a>
        <button type="button" onClick={cerrar} style={{ marginTop: 14, background: "none", border: 0, color: "var(--mu)", fontSize: 14, cursor: "pointer" }}>Ahora no</button>
      </div>
    </div>
  );
}
