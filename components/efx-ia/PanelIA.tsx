'use client';
// =====================================================================
// Panel "Asistente IA" para ADMINISTRADORES.
// Uso: crear una página nueva dentro del área de administración
// (por ejemplo /admin/asistente-ia) que muestre:
//   <PanelIA supabase={supabase} />
// Seguridad: aunque un alumno abra esta página, la función ia-panel
// responde "Solo administradores" y no muestra ningún dato.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import ChatIA from './ChatIA';
import './efx-ia.css';

interface Alerta {
  id: number; alumno_nombre: string; dia: string;
  puntos_registrados: number; puntos_calculados: number; diferencia: number;
  motivo: string; sospechas: string[];
}
interface Revision {
  id: number; alumno_nombre: string; origen_tabla: string; extracto: string;
  probabilidad: 'media' | 'alta'; senales: string[]; fecha: string;
}
interface Derivado { id: number; alumno_nombre: string; pregunta: string; fecha: string }

export default function PanelIA({ supabase }: { supabase: SupabaseClient }) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [revisiones, setRevisiones] = useState<Revision[]>([]);
  const [derivados, setDerivados] = useState<Derivado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.functions.invoke('ia-panel', { body: { accion: 'listar' } });
    if (error) setError('No se pudo cargar el panel. ¿Tu usuario está registrado como administrador?');
    else {
      setAlertas(data.alertas);
      setRevisiones(data.revisiones);
      setDerivados(data.derivados);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function actualizar(tipo: 'alerta' | 'revision', id: number, estado: string) {
    const { error } = await supabase.functions.invoke('ia-panel', { body: { accion: 'actualizar', tipo, id, estado } });
    if (error) return setError('No se pudo guardar el cambio.');
    if (tipo === 'alerta') setAlertas((l) => l.filter((a) => a.id !== id));
    else setRevisiones((l) => l.filter((r) => r.id !== id));
  }

  async function revisarAhora() {
    setRevisando(true);
    setError(null);
    const { error } = await supabase.functions.invoke('ia-auditoria-ranking', { body: {} });
    if (error) setError('No se pudo ejecutar la revisión.');
    await cargar();
    setRevisando(false);
  }

  if (cargando) return <div className="efx-ia"><p className="efx-ia-suave">Cargando…</p></div>;

  return (
    <div className="efx-ia">
      <header className="efx-ia-encabezado">
        <div>
          <h1 className="efx-ia-titulo">Asistente IA</h1>
          <p className="efx-ia-subtitulo">Revisión automática cada noche a las 03:00 (hora de Paraguay)</p>
        </div>
        <button type="button" className="efx-ia-boton efx-ia-boton-principal" onClick={() => void revisarAhora()} disabled={revisando}>
          {revisando ? 'Revisando…' : 'Revisar ayer ahora'}
        </button>
      </header>

      <div className="efx-ia-aviso">
        La IA señala indicios, no pruebas. Las correcciones de puntos se hacen con las herramientas de siempre de la plataforma.
      </div>
      {error && <div className="efx-ia-aviso efx-ia-error" role="alert">{error}</div>}

      <section className="efx-ia-tarjetas" aria-label="Resumen">
        <div className="efx-ia-tarjeta"><span className="efx-ia-tarjeta-etiqueta">Alertas de ranking</span><span className="efx-ia-tarjeta-numero">{alertas.length}</span></div>
        <div className="efx-ia-tarjeta"><span className="efx-ia-tarjeta-etiqueta">Textos para revisar</span><span className="efx-ia-tarjeta-numero">{revisiones.length}</span></div>
        <div className="efx-ia-tarjeta"><span className="efx-ia-tarjeta-etiqueta">Pedidos de ayuda (14 días)</span><span className="efx-ia-tarjeta-numero">{derivados.length}</span></div>
      </section>

      <section className="efx-ia-seccion" aria-labelledby="efx-ia-t-alertas">
        <h2 id="efx-ia-t-alertas">Alertas del ranking</h2>
        {alertas.length === 0 ? <p className="efx-ia-suave">No hay alertas pendientes.</p> : (
          <div className="efx-ia-tabla-caja">
            <table className="efx-ia-tabla">
              <thead><tr><th>Alumno</th><th>Día</th><th>Registrado</th><th>Calculado</th><th>Diferencia</th><th>Motivo</th><th>Acciones</th></tr></thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.alumno_nombre}</strong></td>
                    <td>{a.dia}</td>
                    <td>{a.puntos_registrados} pts</td>
                    <td>{a.puntos_calculados} pts</td>
                    <td><span className={`efx-ia-etiqueta ${a.diferencia !== 0 ? 'efx-ia-etiqueta-alta' : 'efx-ia-etiqueta-neutra'}`}>{a.diferencia > 0 ? `+${a.diferencia}` : a.diferencia}</span></td>
                    <td style={{ minWidth: 240 }}>
                      {a.motivo}
                      {a.sospechas?.length > 0 && <ul className="efx-ia-lista efx-ia-suave">{a.sospechas.map((s) => <li key={s}>{s}</li>)}</ul>}
                    </td>
                    <td>
                      <div className="efx-ia-botones">
                        <button type="button" className="efx-ia-boton efx-ia-boton-principal" onClick={() => void actualizar('alerta', a.id, 'resuelta')}>Marcar resuelta</button>
                        <button type="button" className="efx-ia-boton" onClick={() => void actualizar('alerta', a.id, 'descartada')}>Descartar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="efx-ia-columnas">
        <section className="efx-ia-seccion" aria-labelledby="efx-ia-t-textos">
          <h2 id="efx-ia-t-textos">Textos para revisar</h2>
          {revisiones.length === 0 ? <p className="efx-ia-suave">No hay textos pendientes.</p> : revisiones.map((r) => (
            <article key={r.id} className="efx-ia-item">
              <div className="efx-ia-item-cabecera">
                <span><strong>{r.alumno_nombre}</strong> <span className="efx-ia-suave">· {r.origen_tabla} · {r.fecha}</span></span>
                <span className={`efx-ia-etiqueta efx-ia-etiqueta-${r.probabilidad}`}>PROBABILIDAD {r.probabilidad.toUpperCase()}</span>
              </div>
              <p className="efx-ia-cita">{r.extracto}</p>
              <ul className="efx-ia-lista">{r.senales.map((s) => <li key={s}>{s}</li>)}</ul>
              <div className="efx-ia-botones">
                <button type="button" className="efx-ia-boton efx-ia-boton-principal" onClick={() => void actualizar('revision', r.id, 'pedir_explicacion')}>Marcar: pedir explicación</button>
                <button type="button" className="efx-ia-boton" onClick={() => void actualizar('revision', r.id, 'valido')}>Marcar como válido</button>
              </div>
            </article>
          ))}
        </section>

        <section className="efx-ia-seccion" aria-labelledby="efx-ia-t-soporte">
          <h2 id="efx-ia-t-soporte">Asistente de soporte</h2>
          {derivados.length > 0 && (
            <div className="efx-ia-item">
              <strong>Alumnos que pidieron hablar con una persona</strong>
              <ul className="efx-ia-lista">
                {derivados.map((d) => <li key={d.id}><strong>{d.alumno_nombre}</strong> <span className="efx-ia-suave">({d.fecha})</span>: {d.pregunta}</li>)}
              </ul>
            </div>
          )}
          <ChatIA supabase={supabase} textoCampo="Describe el problema o pega el mensaje del alumno…" />
        </section>
      </div>
    </div>
  );
}
