"use client";
import { useState } from "react";
import BotonEnvio from "@/components/BotonEnvio";

type Resultado = { ok: boolean; error?: string };

// "Reportar": abre un pequeño formulario con el motivo; avisa a los administradores y muestra que ya se envió.
export default function BotonReportar({ action, motivos, campos, ya }: { action: (f: FormData) => Promise<Resultado>; motivos: string[]; campos: Record<string, string>; ya?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [enviado, setEnviado] = useState(!!ya);
  const [error, setError] = useState("");
  async function enviar(datos: FormData) {
    setError("");
    try {
      const r = await action(datos);
      if (r && !r.ok) { setError(r.error || "No se pudo enviar."); if (r.error?.startsWith("Ya reportaste")) setEnviado(true); return; }
      setEnviado(true); setAbierto(false);
    } catch {
      setError("No se pudo enviar el reporte. Revisa tu conexión e intenta de nuevo.");
    }
  }
  if (enviado) return <small className="mu">⚑ Reportado: los administradores lo revisarán</small>;
  return (
    <span className="reportar">
      <button type="button" className="lk" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>⚑ Reportar</button>
      {abierto && (
        <form action={enviar} className="reportar-f">
          {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label>Motivo
            <select name="motivo" required defaultValue="">
              <option value="" disabled>Elige un motivo</option>
              {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>Detalle (opcional)<textarea name="detalle" rows={2} maxLength={500} /></label>
          <BotonEnvio className="btn s" enviando="Enviando…">Enviar reporte</BotonEnvio>
          {error && <small className="lkerr" role="alert">{error}</small>}
        </form>
      )}
    </span>
  );
}
