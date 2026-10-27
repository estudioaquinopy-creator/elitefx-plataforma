"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Tema from "@/components/Tema";
import { createClient } from "@/lib/supabase/client";

// Aquí llega la persona desde el enlace del correo (recuperar contraseña o invitación).
export default function NuevaClave() {
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "listo" | "vencido">("cargando");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = createClient();
    let vivo = true;
    (async () => {
      // El enlace trae un código/token que el navegador canjea por una sesión; damos unos segundos.
      // Enlaces antiguos traen la sesión en el # de la dirección: se toma de ahí.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const at = hash.get("access_token"), rt = hash.get("refresh_token");
      if (at && rt) await sb.auth.setSession({ access_token: at, refresh_token: rt });
      for (let i = 0; i < 10; i++) {
        const { data } = await sb.auth.getSession();
        if (!vivo) return;
        if (data.session) return setEstado("listo");
        await new Promise((r) => setTimeout(r, 500));
      }
      if (vivo) setEstado("vencido");
    })();
    return () => { vivo = false; };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (a.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (a !== b) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: a });
    setBusy(false);
    if (error) return setErr("No se pudo guardar: " + error.message);
    router.replace("/inicio"); router.refresh();
  }

  return (
    <main className="center">
      <div style={{ position: "fixed", top: 16, right: 16 }}><Tema /></div>
      <form className="card" onSubmit={guardar}>
        <div className="logo"><img src="/logo-elitefx.png" alt="ELITE FX · Trading de Alta Precisión" /></div>
        <h1>Crea tu contraseña</h1>
        {estado === "cargando" && <p className="sub">Verificando tu enlace…</p>}
        {estado === "vencido" && (
          <>
            <p className="alerta">El enlace venció o ya fue usado. Pide uno nuevo.</p>
            <Link className="btn" href="/recuperar" style={{ textAlign: "center" }}>Pedir un enlace nuevo</Link>
          </>
        )}
        {estado === "listo" && (
          <>
            <p className="sub">Elige la contraseña con la que entrarás a la plataforma.</p>
            <label>Nueva contraseña (mínimo 8 caracteres)<input type="password" autoComplete="new-password" minLength={8} required value={a} onChange={(e) => setA(e.target.value)} /></label>
            <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} required value={b} onChange={(e) => setB(e.target.value)} /></label>
            {err && <p className="err">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
          </>
        )}
      </form>
    </main>
  );
}
