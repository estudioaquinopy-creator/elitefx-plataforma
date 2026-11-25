// =====================================================================
// ia-soporte
// Chat de ayuda. Lo usan alumnos y administradores, con manuales y
// permisos distintos:
//   - Alumno: solo ve sus propios datos, no puede cambiar nada y nunca
//     recibe información de revisiones o alertas.
//   - Admin: puede consultar los datos de un alumno indicando su id.
// =====================================================================
import { cabecerasCors, errorSimple, esAdmin, json, sql, usuarioActual } from '../_shared/base.ts';
import { puedeUsarAsistente, resumenAlumno } from '../_shared/adaptador.ts';
import { preguntarAClaude, type MensajeChat } from '../_shared/claude.ts';
import { MANUAL_SOPORTE_ADMIN, MANUAL_SOPORTE_ALUMNO } from '../_shared/manuales.ts';

const LIMITE_DIARIO_ALUMNO = Number(Deno.env.get('IA_LIMITE_DIARIO_ALUMNO') ?? 20);
const MAX_CARACTERES = 1500;
const MAX_HISTORIAL = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors(req) });
  if (req.method !== 'POST') return errorSimple(req, 'Método no permitido', 405);

  const usuario = await usuarioActual(req);
  if (!usuario) return errorSimple(req, 'Inicia sesión para usar el asistente', 401);
  const admin = await esAdmin(usuario.id);
  // Solo administradores y miembros VIP (mismo criterio que la pestaña Comunidad).
  if (!admin && !(await puedeUsarAsistente(usuario.id))) {
    return errorSimple(req, 'El asistente es para miembros VIP.', 403);
  }

  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo) return errorSimple(req, 'Solicitud inválida', 400);

  // --- El alumno pide hablar con una persona del equipo ---
  if (cuerpo.accion === 'derivar') {
    const detalle = String(cuerpo.mensaje ?? '').slice(0, MAX_CARACTERES) || 'El alumno pidió hablar con una persona.';
    await sql`
      insert into ia.registro_soporte (usuario_id, rol, pregunta, respuesta, derivado)
      values (${usuario.id}, ${admin ? 'admin' : 'alumno'}, ${detalle}, '', true)
    `;
    return json(req, { respuesta: 'Listo. Una persona del equipo va a revisar tu consulta y te va a responder.' });
  }

  const mensaje = String(cuerpo.mensaje ?? '').trim();
  if (!mensaje) return errorSimple(req, 'Escribe tu pregunta', 400);
  if (mensaje.length > MAX_CARACTERES) return errorSimple(req, `La pregunta es muy larga (máx. ${MAX_CARACTERES} caracteres)`, 400);

  // --- Límite diario para alumnos (controla el gasto) ---
  if (!admin) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from ia.registro_soporte
      where usuario_id = ${usuario.id} and not derivado
        and creado_en > now() - interval '24 hours'
    `;
    if (n >= LIMITE_DIARIO_ALUMNO) {
      return json(req, {
        respuesta: 'Llegaste al límite de consultas de hoy. Si es urgente, usa "Hablar con una persona del equipo".',
        limite: true,
      });
    }
  }

  // --- Contexto según el rol ---
  let sistema: string;
  let sistemaVariable: string | undefined;
  if (admin) {
    const alumnoId = typeof cuerpo.alumnoId === 'string' && UUID.test(cuerpo.alumnoId) ? cuerpo.alumnoId : null;
    sistema = MANUAL_SOPORTE_ADMIN;
    if (alumnoId) sistemaVariable = `DATOS DEL ALUMNO CONSULTADO:\n${await resumenAlumno(alumnoId)}`;
  } else {
    // El alumno solo recibe SUS datos: el id sale de su sesión, nunca del mensaje.
    sistema = MANUAL_SOPORTE_ALUMNO;
    sistemaVariable = `DATOS DE LA CUENTA DE ESTE ALUMNO:\n${await resumenAlumno(usuario.id)}`;
  }

  // Historial reciente de la conversación (enviado por la pantalla)
  const historial: MensajeChat[] = Array.isArray(cuerpo.historial)
    ? cuerpo.historial
      .filter((m: MensajeChat) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORIAL)
      .map((m: MensajeChat) => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES) }))
    : [];
  while (historial.length && historial[0].role !== 'user') historial.shift();

  let respuesta: string;
  try {
    respuesta = await preguntarAClaude({
      sistema,
      sistemaVariable,
      mensajes: [...historial, { role: 'user', content: mensaje }],
      maxTokens: admin ? 900 : 500,
    });
  } catch (e) {
    console.error(e);
    return errorSimple(req, 'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.', 503);
  }

  await sql`
    insert into ia.registro_soporte (usuario_id, rol, pregunta, respuesta)
    values (${usuario.id}, ${admin ? 'admin' : 'alumno'}, ${mensaje}, ${respuesta})
  `;

  return json(req, { respuesta });
});
