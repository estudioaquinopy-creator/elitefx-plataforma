// =====================================================================
// Conexión con la API de Claude (Anthropic).
// La clave se lee del secret ANTHROPIC_API_KEY: nunca va en el código
// ni llega al navegador.
// =====================================================================

const MODELO = Deno.env.get('IA_MODELO') ?? 'claude-sonnet-5-5';

export interface MensajeChat {
  role: 'user' | 'assistant';
  content: string;
}

export async function preguntarAClaude(opciones: {
  /** Instrucciones fijas (manual + base de conocimiento). Se guardan en caché para bajar el costo. */
  sistema: string;
  /** Datos que cambian en cada consulta (por ejemplo, los puntos del alumno). */
  sistemaVariable?: string;
  mensajes: MensajeChat[];
  maxTokens?: number;
}): Promise<string> {
  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) throw new Error('Falta el secret ANTHROPIC_API_KEY');

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': clave,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: opciones.maxTokens ?? 1024,
      system: [
        { type: 'text', text: opciones.sistema, cache_control: { type: 'ephemeral' } },
        ...(opciones.sistemaVariable ? [{ type: 'text', text: opciones.sistemaVariable }] : []),
      ],
      messages: opciones.mensajes,
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`API de Claude respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }
  const datos = await respuesta.json();
  return (datos.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
}

/** Para las tareas que piden respuesta en JSON: extrae y valida el objeto. */
export async function preguntarJSON<T>(opciones: {
  sistema: string;
  mensaje: string;
  maxTokens?: number;
}): Promise<T> {
  const texto = await preguntarAClaude({
    sistema: opciones.sistema,
    mensajes: [{ role: 'user', content: opciones.mensaje }],
    maxTokens: opciones.maxTokens,
  });
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error(`Respuesta sin JSON: ${texto.slice(0, 200)}`);
  return JSON.parse(texto.slice(inicio, fin + 1)) as T;
}
