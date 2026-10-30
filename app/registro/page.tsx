"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";
import { REFERIDOS_DESDE } from "@/lib/referidos";

export default function Registro() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [codigo, setCodigo] = useState("");
  // El campo de código solo se muestra desde la fecha de inicio de los referidos (la base de datos también la controla).
  const [verCodigo, setVerCodigo] = useState(false);
  useEffect(() => {
    setVerCodigo(new Date() >= new Date(REFERIDOS_DESDE + "T00:00:00-03:00"));
    try { const r = new URLSearchParams(window.location.search).get("ref"); if (r) setCodigo(r.trim().toUpperCase().slice(0, 20)); } catch { /* sin enlace de referido */ }
  }, []);
  const [err, setErr] = useState("");
  const [listo, setListo] = useState(false);
  const [busy, setBusy] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const n = nombre.trim().replace(/\s+/g, " ");
    const t = tel.replace(/[^\d+]/g, "");
    if (n.split(" ").length < 2) return setErr("Escribe tu nombre completo (nombre y apellido).");
    if (t.replace(/\D/g, "").length < 8) return setErr("Escribe un número de teléfono válido, con código de país (ej.: +595981123456).");
    if (pw.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (pw !== pw2) return setErr("Las contraseñas no coinciden.");
    const cod = codigo.trim().toUpperCase();
    if (verCodigo && cod && !/^EFX-[A-Z0-9]{6}$/.test(cod)) return setErr("El código de referido no es válido (ejemplo: EFX-1A2B3C). Déjalo vacío si no tienes uno.");
    setBusy(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { nombre: n, telefono: t, ...(cod ? { codigo_ref: cod } : {}) } } });
    if (error) {
      setBusy(false);
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered")) return setErr("Ese correo ya tiene una cuenta. Inicia sesión.");
      if (m.includes("rate") || m.includes("limit")) return setErr("Demasiados intentos. Espera unos minutos e inténtalo otra vez.");
      return setErr("No se pudo crear la cuenta: " + error.message);
    }
    // Si el proyecto no pide confirmar el correo, la sesión ya está activa: guardamos el teléfono.
    if (data.session && data.user) {
      await sb.from("perfiles").update({ nombre: n, telefono: t }).eq("id", data.user.id);
      router.replace("/inicio"); router.refresh();
      return;
    }
    setBusy(false);
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
            <p className="sub">Accede al Curso básico y a nuestro broker recomendado.</p>
            <label>Nombre completo<input autoComplete="name" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
            <label>Teléfono / WhatsApp<input type="tel" autoComplete="tel" required value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+595 981 123456" /></label>
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Contraseña (mínimo 8 caracteres)<input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            {verCodigo && <label>Código de referido (opcional)<input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="EFX-1A2B3C" maxLength={20} autoComplete="off" /></label>}
            {err && <p className="err">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear cuenta"}</button>
            <p className="mu" style={{ textAlign: "center", marginTop: 12 }}>¿Ya tienes cuenta? <Link href="/login" className="lk">Inicia sesión</Link></p>
          </>
        )}
      </form>
    </main>
  );
}
