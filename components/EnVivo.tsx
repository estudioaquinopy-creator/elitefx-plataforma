"use client";
import { useEffect, useState } from "react";

export type SesionVivo = { id: string; titulo: string; inicio: string; zoom: string };

const VENTANA_AVISO = 60 * 60 * 1000;   // cuenta regresiva desde 60 min antes
const DURACION = 90 * 60 * 1000;        // el botón sigue disponible mientras dura la sesión

const dos = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => (s >= 3600 ? Math.floor(s / 3600) + ":" : "") + dos(Math.floor((s % 3600) / 60)) + ":" + dos(s % 60);

export default function EnVivo({ sesiones }: { sesiones: SesionVivo[] }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;

  const lista = sesiones.map((s) => ({ ...s, t: new Date(s.inicio).getTime() })).sort((a, b) => a.t - b.t);
  const enCurso = [...lista].reverse().find((s) => s.t <= ahora && ahora < s.t + DURACION);
  const proxima = lista.find((s) => s.t > ahora && s.t - ahora <= VENTANA_AVISO);

  if (enCurso) {
    return (
      <section className="live on" role="status">
        <div><span className="dotv" /> <b>En vivo ahora</b><small>{enCurso.titulo}</small></div>
        {enCurso.zoom ? <a className="btn sd" href={enCurso.zoom} target="_blank" rel="noopener noreferrer">Unirme a la sesión en vivo</a> : <span className="mu">Enlace pendiente</span>}
      </section>
    );
  }
  if (proxima) {
    const s = Math.max(0, Math.ceil((proxima.t - ahora) / 1000));
    return (
      <section className="live pre" role="status">
        <div><b>Empieza en {hms(s)}</b><small>{proxima.titulo}</small></div>
        <span className="mu">El botón para unirte aparece aquí al llegar a cero</span>
      </section>
    );
  }
  return null;
}
