"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";
import Captcha, { CAPTCHA_ACTIVO } from "@/components/Captcha";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [expirada, setExpirada] = useState(false);
  const [token, setToken] = useState("");
  const [reinicio, setReinicio] = useState(0);
  useEffect(() => { setExpirada(new URLSearchParams(window.location.search).get("expirada") === "1"); }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (CAPTCHA_ACTIVO && !token) return setErr("Completa la verificación de seguridad.");
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: pw, ...(CAPTCHA_ACTIVO ? { options: { captchaToken: token } } : {}) });
    setBusy(false);
    if (error) {
      setReinicio((r) => r + 1);
      const m = error.message.toLowerCase();
      if (m.includes("captcha")) return setErr("No pudimos verificar que eres una persona. Inténtalo de nuevo.");
      if (m.includes("not confirmed")) return setErr("Tu correo aún no está confirmado.");
      if (m.includes("invalid login")) return setErr("Correo o contraseña incorrectos.");
      return setErr("No se pudo iniciar sesión: " + error.message);
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" onSubmit={entrar}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Bienvenido de vuelta</h1>
        <p className="sub">Ingresa para continuar con tu formación.</p>
        {expirada && <p className="err">Tu sesión se cerró por inactividad. Vuelve a ingresar.</p>}
        <label>Correo electrónico
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Contraseña
          <input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <p style={{ textAlign: "right", margin: "-6px 0 12px" }}><Link href="/recuperar" className="lk">¿Olvidaste tu contraseña?</Link></p>
        <Captcha onToken={setToken} reinicio={reinicio} />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <p className="mu" style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}>Al entrar aceptas los <Link href="/terminos" className="lk">términos y condiciones</Link> y la <Link href="/privacidad" className="lk">política de privacidad</Link>. Contenido educativo, no es recomendación de inversión.</p>
        <p className="mu" style={{ textAlign: "center", marginTop: 12 }}>¿No tienes cuenta? <Link href="/registro" className="lk">Crea una gratis</Link></p>
      </form>
    </main>
  );
}
