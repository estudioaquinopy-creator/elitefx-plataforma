'use client';
// =====================================================================
// Pestaña "Asistente" para alumnos (al lado de "Comunidad").
// Uso: crear una página nueva (por ejemplo /asistente) que muestre:
//   <AyudaIA supabase={supabase} />
// Lo único que se toca de lo existente es agregar el enlace
// "Asistente" al menú, igual que los demás enlaces.
// =====================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import ChatIA from './ChatIA';
import './efx-ia.css';

export default function AyudaIA({ supabase }: { supabase: SupabaseClient }) {
  return (
    <div className="efx-ia">
      <div>
        <h1 className="efx-ia-titulo">Asistente ELITE FX</h1>
        <p className="efx-ia-subtitulo">Pregunta sobre trading, el broker, el ranking, tus puntos o la plataforma.</p>
      </div>

      <div className="efx-ia-columnas">
        <section className="efx-ia-seccion" aria-label="Chat con el asistente" style={{ flexGrow: 3 }}>
          <ChatIA
            supabase={supabase}
            permitirDerivar
            sugerencias={[
              '¿Qué es el spread?',
              '¿Qué es la liquidez?',
              '¿Cómo creo mi cuenta en el broker?',
              '¿Cómo cargo dinero en el broker?',
              '¿Cómo gano puntos?',
            ]}
          />
        </section>

        <aside className="efx-ia-seccion" aria-labelledby="efx-ia-que-puede">
          <h2 id="efx-ia-que-puede">¿Qué puede hacer el asistente?</h2>
          <ul className="efx-ia-lista">
            <li>Explicarte conceptos de trading con ejemplos</li>
            <li>Guiarte con tu cuenta del broker</li>
            <li>Explicarte las reglas del ranking y revisar tus puntos</li>
            <li>Ayudarte con problemas de la plataforma</li>
          </ul>
          <ul className="efx-ia-lista efx-ia-suave">
            <li>No cambia puntos: eso lo decide el equipo</li>
            <li>No ve datos de otros alumnos</li>
            <li>No da señales ni recomendaciones de inversión</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
