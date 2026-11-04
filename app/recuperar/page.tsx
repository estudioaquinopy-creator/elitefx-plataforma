"use client";
import { useState } from "react";
import Link from "next/link";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";
import Captcha, { CAPTCHA_ACTIVO } from "@/components/Captcha";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [listo, setListo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [reinicio, setReinicio] = useState(0);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (CAPTCHA_ACTIVO && !token) return setErr("Completa la verificación de seguridad.");
    setBusy(true); setErr("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + "/nueva-clave", ...(CAPTCHA_ACTIVO ? { captchaToken: token } : {}) });
    setBusy(false);
    if (error) {
      setReinicio((r) => r + 1);
      if (error.message.toLowerCase().includes("captcha")) return setErr("No pudimos verificar que eres una persona. Inténtalo de nuevo.");
      const m = error.message.toLowerCase();
      if (m.includes("rate") || m.includes("limit") || m.includes("seconds")) return setErr("Espera un momento antes de pedir otro enlace.");
      return setErr("No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.");
    }
    setListo(true);
  }

  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" onSubmit={enviar}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Recupera tu contraseña</h1>
        {listo ? (
          <>
            <p className="okmsg">Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</p>
            <Link className="btn" href="/login" style={{ textAlign: "center" }}>Volver a iniciar sesión</Link>
          </>
        ) : (
          <>
            <p className="sub">Escribe tu correo y te enviaremos un enlace para elegir una contraseña nueva.</p>
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <Captcha onToken={setToken} reinicio={reinicio} />
            {err && <p className="err">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button>
            <p className="mu" style={{ textAlign: "center", marginTop: 12 }}><Link href="/login" className="lk">Volver a iniciar sesión</Link></p>
          </>
        )}
      </form>
    </main>
  );
}
