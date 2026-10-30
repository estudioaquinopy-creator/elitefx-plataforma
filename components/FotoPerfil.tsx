"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subirAvatar } from "@/lib/avatar";

// Cambiar la foto de perfil (es obligatoria, por eso ya no se puede quitar) desde "Editar perfil".
export default function FotoPerfil({ uid, url, iniciales }: { uid: string; url: string | null; iniciales: string }) {
  const router = useRouter();
  const [actual, setActual] = useState(url);
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setEstado("Procesando…");
    try { setActual(await subirAvatar(uid, f)); setEstado("Foto actualizada."); router.refresh(); }
    catch (err) { setEstado("No se pudo subir: " + (err as Error).message); }
    setBusy(false); e.target.value = "";
  }
  return (
    <div className="fp">
      <span className="fp-av">{actual ? <img src={actual} alt="Tu foto" /> : iniciales}</span>
      <div>
        <label className="btn g s fp-b">{busy ? <><span className="btn-spin" /> Procesando…</> : "Cambiar foto"}<input type="file" accept="image/*" hidden disabled={busy} onChange={elegir} /></label>
        {estado && <small className="mu" style={{ display: "block", marginTop: 6 }}>{estado}</small>}
      </div>
    </div>
  );
}
