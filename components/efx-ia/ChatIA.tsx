'use client';
// =====================================================================
// Chat del asistente (lo usan la página de ayuda del alumno y el panel
// de administración). Habla solo con la función ia-soporte.
// =====================================================================
import { useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  supabase: SupabaseClient;
  /** Preguntas sugeridas que se muestran como botones. */
  sugerencias?: string[];
  /** Solo admins: id del alumno sobre el que se consulta. */
  alumnoId?: string;
  /** Muestra el enlace "Hablar con una persona del equipo" (alumnos). */
  permitirDerivar?: boolean;
  textoCampo?: string;
}

export default function ChatIA({ supabase, sugerencias = [], alumnoId, permitirDerivar = false, textoCampo }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  async function llamar(body: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ia-soporte', { body });
    if (error) {
      // El mensaje de error de la función viene en el cuerpo de la respuesta
      const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(detalle?.error ?? 'El asistente no está disponible en este momento.');
    }
    return data.respuesta as string;
  }

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || enviando) return;
    setError(null);
    setEnviando(true);
    const historial = mensajes;
    setMensajes([...historial, { role: 'user', content: limpia }]);
    setTexto('');
    try {
      const respuesta = await llamar({ mensaje: limpia, historial, alumnoId });
      setMensajes((m) => [...m, { role: 'assistant', content: respuesta }]);
    } catch (e) {
      setError((e as Error).message);
      setMensajes(historial); // se quita la pregunta que no tuvo respuesta
      setTexto(limpia);
    } finally {
      setEnviando(false);
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    }
  }

  async function derivar() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const resumen = mensajes.filter((m) => m.role === 'user').map((m) => m.content).join(' | ');
      const respuesta = await llamar({ accion: 'derivar', mensaje: resumen });
      setMensajes((m) => [...m, { role: 'assistant', content: respuesta }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(texto);
  }

  return (
    <div className="efx-ia-chat">
      <div className="efx-ia-mensajes" aria-live="polite">
        {mensajes.map((m, i) =>
          m.role === 'user'
            ? <div key={i} className="efx-ia-burbuja efx-ia-burbuja-usuario">{m.content}</div>
            : <div key={i} className="efx-ia-burbuja efx-ia-burbuja-ia"><strong>Asistente</strong>{m.content}</div>,
        )}
        {enviando && <div className="efx-ia-burbuja efx-ia-burbuja-ia efx-ia-suave">Escribiendo…</div>}
        <div ref={finRef} />
      </div>

      {mensajes.length === 0 && sugerencias.length > 0 && (
        <div className="efx-ia-sugerencias">
          {sugerencias.map((s) => (
            <button key={s} type="button" className="efx-ia-sugerencia" onClick={() => void enviar(s)} disabled={enviando}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div className="efx-ia-aviso efx-ia-error" role="alert">{error}</div>}

      <form className="efx-ia-formulario" onSubmit={alEnviar}>
        <label htmlFor="efx-ia-pregunta" className="efx-ia-solo-lector">Escribe tu pregunta</label>
        <input
          id="efx-ia-pregunta"
          className="efx-ia-campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={textoCampo ?? 'Escribe tu pregunta…'}
          maxLength={1500}
          autoComplete="off"
        />
        <button type="submit" className="efx-ia-boton efx-ia-boton-principal" disabled={enviando || !texto.trim()}>
          Enviar
        </button>
      </form>

      {permitirDerivar && (
        <button type="button" className="efx-ia-enlace" onClick={() => void derivar()} disabled={enviando}>
          ¿No se resolvió? Hablar con una persona del equipo
        </button>
      )}
    </div>
  );
}
