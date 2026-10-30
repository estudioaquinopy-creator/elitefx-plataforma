"use client";
import { useState } from "react";
import BotonEnvio from "./BotonEnvio";

// Formulario para pedir una visita: el horario ocupado (ya aprobado para otra persona) aparece deshabilitado.
export default function FormVisita({ action, fechas, horas, temas, ocupadas }: {
  action: (f: FormData) => void | Promise<void>;
  fechas: { v: string; t: string }[];
  horas: string[];
  temas: string[];
  ocupadas: string[]; // "YYYY-MM-DD HH:MM"
}) {
  const [fecha, setFecha] = useState(fechas[0]?.v ?? "");
  const [hora, setHora] = useState("");
  const [tema, setTema] = useState(temas[0] ?? "");
  const libre = (h: string) => !ocupadas.includes(fecha + " " + h);
  return (
    <form action={action} className="fm">
      <label>Día (solo miércoles)
        <select name="fecha" value={fecha} onChange={(e) => { setFecha(e.target.value); setHora(""); }} required>
          {fechas.map((f) => <option key={f.v} value={f.v}>{f.t}</option>)}
        </select>
      </label>
      <label>Horario (de 8:00 a 17:00, turnos de 1 hora)
        <select name="hora" value={hora} onChange={(e) => setHora(e.target.value)} required>
          <option value="" disabled>Elige un horario…</option>
          {horas.map((h) => <option key={h} value={h} disabled={!libre(h)}>{h}{libre(h) ? "" : " · ocupado"}</option>)}
        </select>
      </label>
      <label>¿Qué quieres tratar?
        <select name="tema" value={tema} onChange={(e) => setTema(e.target.value)} required>
          {temas.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>Cuéntanos más{tema === "Otro" ? "" : " (opcional)"}
        <textarea name="detalle" rows={3} maxLength={600} placeholder="Ej.: quiero cargar mi cuenta de Liquid y dejar MetaTrader listo con mis indicadores." required={tema === "Otro"} />
      </label>
      <BotonEnvio className="btn" enviando="Enviando…">Solicitar visita</BotonEnvio>
    </form>
  );
}
