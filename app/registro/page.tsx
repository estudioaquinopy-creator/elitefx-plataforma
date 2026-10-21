"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";

export default function Registro() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [listo, setListo] = useState(false);
  const [busy, setBusy] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    setBusy(true);
    const { data, error } = await createClient().auth.signUp({ email: email.trim(), password: pw, options: { data: { nombre: nombre.trim() } } });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered")) return setErr("Ese correo ya tiene una cuenta. Inicia sesión.");
      if (m.includes("rate") || m.includes("limit")) return setErr("Demasiados intentos. Espera unos minutos e inténtalo otra vez.");
      return setErr("No se pudo crear la cuenta: " + error.message);
    }
    // Si el proyecto no pide confirmar el correo, la sesión ya está activa.
    if (data.session) { router.replace("/inicio"); router.refresh(); return; }
    setListo(true);
  }

  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" onSubmit={crear}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Crea tu cuenta gratis</h1>
        {listo ? (
          <>
            <p className="okmsg">Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión.</p>
            <Link className="btn" href="/login" style={{ textAlign: "center" }}>Ir a iniciar sesión</Link>
          </>
        ) : (
          <>
            <p className="sub">Accede al Curso básico y a los aliados de ELITE FX.</p>
            <label>Nombre<input autoComplete="name" required value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Contraseña (mínimo 8 caracteres)<input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            {err && <p className="err">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</button>
            <p className="mu" style={{ textAlign: "center", marginTop: 12 }}>¿Ya tienes cuenta? <Link href="/login" className="lk">Inicia sesión</Link></p>
          </>
        )}
      </form>
    </main>
  );
}
