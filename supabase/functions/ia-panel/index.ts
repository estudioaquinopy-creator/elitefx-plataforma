// =====================================================================
// ia-panel
// Datos del panel de administración. SOLO administradores.
// Lista alertas, revisiones y pedidos de soporte, y permite marcarlos
// como resueltos. No cambia puntos ni contenido de la plataforma:
// las correcciones se hacen con las herramientas que ya existen.
// =====================================================================
import { cabecerasCors, errorSimple, esAdmin, json, sql, usuarioActual } from '../_shared/base.ts';
import { nombresDeAlumnos } from '../_shared/adaptador.ts';

const ESTADOS_ALERTA = ['pendiente', 'resuelta', 'descartada'];
const ESTADOS_REVISION = ['pendiente', 'valido', 'pedir_explicacion', 'descartada'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors(req) });
  if (req.method !== 'POST') return errorSimple(req, 'Método no permitido', 405);

  const usuario = await usuarioActual(req);
  if (!usuario || !(await esAdmin(usuario.id))) return errorSimple(req, 'Solo administradores', 403);

  const cuerpo = await req.json().catch(() => ({}));

  if (cuerpo.accion === 'listar') {
    const [alertas, revisiones, derivados] = await Promise.all([
      sql`
        select id, alumno_id, alumno_nombre, to_char(dia, 'DD/MM/YYYY') as dia,
               puntos_registrados, puntos_calculados, diferencia, motivo, detalle, sospechas
        from ia.alertas_ranking where estado = 'pendiente'
        order by abs(diferencia) desc, dia desc limit 100
      `,
      sql`
        select id, origen_tabla, origen_id, alumno_id, alumno_nombre, extracto, probabilidad, senales,
               to_char(creado_en at time zone 'America/Asuncion', 'DD/MM HH24:MI') as fecha
        from ia.revisiones_textos where estado = 'pendiente'
        order by (probabilidad = 'alta') desc, creado_en desc limit 100
      `,
      sql`
        select s.id, s.usuario_id, s.pregunta,
               to_char(s.creado_en at time zone 'America/Asuncion', 'DD/MM HH24:MI') as fecha
        from ia.registro_soporte s
        where s.derivado and s.creado_en > now() - interval '14 days'
        order by s.creado_en desc limit 50
      `,
    ]);
    const nombres = await nombresDeAlumnos([...new Set(derivados.map((d) => String(d.usuario_id)))]);
    const derivadosConNombre = derivados.map((d) => ({ ...d, alumno_nombre: nombres[String(d.usuario_id)] ?? 'Alumno' }));
    return json(req, { alertas, revisiones, derivados: derivadosConNombre });
  }

  if (cuerpo.accion === 'actualizar') {
    const id = Number(cuerpo.id);
    const nota = typeof cuerpo.nota === 'string' ? cuerpo.nota.slice(0, 1000) : null;
    if (!Number.isInteger(id)) return errorSimple(req, 'id inválido', 400);

    if (cuerpo.tipo === 'alerta' && ESTADOS_ALERTA.includes(cuerpo.estado)) {
      await sql`
        update ia.alertas_ranking
        set estado = ${cuerpo.estado}, nota_admin = ${nota}, resuelta_por = ${usuario.id}, resuelta_en = now()
        where id = ${id}
      `;
      return json(req, { ok: true });
    }
    if (cuerpo.tipo === 'revision' && ESTADOS_REVISION.includes(cuerpo.estado)) {
      await sql`
        update ia.revisiones_textos
        set estado = ${cuerpo.estado}, nota_admin = ${nota}, resuelta_por = ${usuario.id}, resuelta_en = now()
        where id = ${id}
      `;
      return json(req, { ok: true });
    }
    return errorSimple(req, 'Tipo o estado inválido', 400);
  }

  return errorSimple(req, 'Acción desconocida', 400);
});
