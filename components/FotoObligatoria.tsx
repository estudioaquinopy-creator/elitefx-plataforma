"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { subirAvatar } from "@/lib/avatar";

// Pantalla de primera vez: la foto de perfil es obligatoria para entrar a la plataforma.
export default function FotoObligatoria({ uid, iniciales }: { uid: string; iniciales: string }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setEstado("Procesando…");
    try {
      setUrl(await subirAvatar(uid, f));
      setEstado("");
      router.replace("/inicio");
      router.refresh();
    } catch (err) {
      setEstado("No se pudo subir: " + (err as Error).message);
      setBusy(false);
    }
    e.target.value = "";
  }

  return (
    <div style={{ textAlign: "center" }}>
      <span className="fp-av" style={{ width: 120, height: 120, fontSize: 40, margin: "0 auto 16px" }}>{url ? <img src={url} alt="Tu foto" /> : iniciales}</span>
      <label className="btn" style={{ width: "100%" }}>
        {busy ? <><span className="btn-spin" /> Subiendo…</> : "Elegir mi foto"}
        <input type="file" accept="image/*" hidden disabled={busy} onChange={elegir} />
      </label>
      {estado && <p className="mu" style={{ marginTop: 10 }}>{estado}</p>}
    </div>
  );
}
