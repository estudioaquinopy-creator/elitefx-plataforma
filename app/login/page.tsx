"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr("Correo o contraseña incorrectos.");
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <main className="center">
      <form className="card" onSubmit={entrar}>
        <div className="logo">ELITE <span>FX</span></div>
        <h1>Bienvenido de vuelta</h1>
        <p className="sub">Ingresa para continuar con tu formación.</p>
        <label>Correo electrónico
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Contraseña
          <input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
