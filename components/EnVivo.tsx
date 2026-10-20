"use client";
import { useEffect, useState } from "react";

export type SesionVivo = { id: string; titulo: string; inicio: string; zoom: string };

const VENTANA_AVISO = 60 * 60 * 1000;   // cuenta regresiva desde 60 min antes
const DURACION = 90 * 60 * 1000;        // el botón sigue disponible mientras dura la sesión
const dos = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => (s >= 3600 ? Math.floor(s / 3600) + ":" : "") + dos(Math.floor((s % 3600) / 60)) + ":" + dos(s % 60);
const ZONA = "America/Asuncion";

// Lista "Próximas sesiones": la sesión que está por empezar (≤ 60 min) deja de mostrarse con su título
// y pasa a mostrar la cuenta regresiva; al llegar a cero aparece el botón para unirse.
export default function EnVivo({ sesiones, ahoraServidor }: { sesiones: SesionVivo[]; ahoraServidor: number }) {
  const [ahora, setAhora] = useState(ahoraServidor);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lista = sesiones.map((s) => ({ ...s, t: new Date(s.inicio).getTime() })).sort((a, b) => a.t - b.t);
  const enCurso = [...lista].reverse().find((s) => s.t <= ahora && ahora < s.t + DURACION);
  const proxima = lista.find((s) => s.t > ahora && s.t - ahora <= VENTANA_AVISO);
  const resto = lista.filter((s) => s.t > ahora && s !== proxima).slice(0, 3);

  return (
    <>
      {enCurso && (
        <div className="live on" role="status">
          <div><span className="dotv" /> <b>En vivo ahora</b></div>
          {enCurso.zoom ? <a className="btn sd" href={enCurso.zoom} target="_blank" rel="noopener noreferrer">Unirme a la sesión en vivo</a> : <span className="mu">Enlace pendiente</span>}
        </div>
      )}
      {!enCurso && proxima && (
        <div className="live pre" role="status">
          <div><b>Empieza en {hms(Math.max(0, Math.ceil((proxima.t - ahora) / 1000)))}</b></div>
          <span className="mu">El botón para unirte aparece al llegar a cero</span>
        </div>
      )}
      {!enCurso && !proxima && resto.length === 0 && <p className="mu">No hay sesiones programadas todavía.</p>}
      {resto.map((s) => {
        const d = new Date(s.t);
        return (
          <div key={s.id} className="ses">
            <div className="dt">{d.toLocaleDateString("es-PY", { timeZone: ZONA, month: "short" }).toUpperCase()}<b>{d.toLocaleDateString("es-PY", { timeZone: ZONA, day: "numeric" })}</b></div>
            <div style={{ flex: 1 }}><b>{s.titulo}</b><small className="mu" style={{ display: "block" }}>{d.toLocaleTimeString("es-PY", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false })} · horario de Paraguay</small></div>
          </div>
        );
      })}
    </>
  );
}
