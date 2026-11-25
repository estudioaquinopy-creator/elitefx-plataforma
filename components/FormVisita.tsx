"use client";
import { useState } from "react";
import BotonEnvio from "./BotonEnvio";

// Formulario para pedir una visita a la oficina o una reunión virtual con un educador.
// Presencial: el horario ocupado (ya aprobado) aparece deshabilitado. Virtual: se elige educador y se bloquean sus horarios ya aprobados.
export default function FormVisita({ action, fechas, horas, temas, ocupadas, virtual = false, educadores = [], ocupadasEdu = [] }: {
  action: (f: FormData) => void | Promise<void>;
  fechas: { v: string; t: string }[];
  horas: string[];
  temas: string[];
  ocupadas: string[]; // "YYYY-MM-DD HH:MM" (horarios de la oficina que ya no están disponibles)
  virtual?: boolean;
  educadores?: { id: string; nombre: string }[];
  ocupadasEdu?: string[]; // "YYYY-MM-DD HH:MM ID_EDUCADOR"
}) {
  const [fecha, setFecha] = useState(fechas[0]?.v ?? "");
  const [hora, setHora] = useState("");
  const [tema, setTema] = useState(temas[0] ?? "");
  const [edu, setEdu] = useState("");
  const libre = (h: string) => virtual ? !!edu && !ocupadasEdu.includes(fecha + " " + h + " " + edu) : !ocupadas.includes(fecha + " " + h);
  return (
    <form action={action} className="fm">
      {virtual && <input type="hidden" name="modalidad" value="virtual" />}
      {virtual && (
        <label>¿Con qué educador?
          <select name="educador" value={edu} onChange={(e) => { setEdu(e.target.value); setHora(""); }} required>
            <option value="" disabled>Elige un educador…</option>
            {educadores.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>
      )}
      <label>Día (solo miércoles)
        <select name="fecha" value={fecha} onChange={(e) => { setFecha(e.target.value); setHora(""); }} required>
          {fechas.map((f) => <option key={f.v} value={f.v}>{f.t}</option>)}
        </select>
      </label>
      <label>Horario (de 8:00 a 17:00, turnos de 1 hora)
        <select name="hora" value={hora} onChange={(e) => setHora(e.target.value)} required>
          <option value="" disabled>{virtual && !edu ? "Primero elige un educador…" : "Elige un horario…"}</option>
          {horas.map((h) => <option key={h} value={h} disabled={!libre(h)}>{h}{virtual && !edu ? "" : libre(h) ? "" : " · ocupado"}</option>)}
        </select>
      </label>
      <label>¿Qué quieres tratar?
        <select name="tema" value={tema} onChange={(e) => setTema(e.target.value)} required>
          {temas.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>Cuéntanos más{tema === "Otro" ? "" : " (opcional)"}
        <textarea name="detalle" rows={3} maxLength={600} placeholder={virtual ? "Ej.: quiero revisar mi operativa de la semana y resolver dudas de la estrategia." : "Ej.: quiero cargar mi cuenta de Liquid y dejar MetaTrader listo con mis indicadores."} required={tema === "Otro"} />
      </label>
      <BotonEnvio className="btn" enviando="Enviando…">{virtual ? "Solicitar reunión virtual" : "Solicitar visita"}</BotonEnvio>
    </form>
  );
}
