// =====================================================================
// ia-auditoria-ranking
// Se ejecuta cada noche (tarea programada). Recalcula los puntos del día
// anterior con el reglamento y guarda alertas en ia.alertas_ranking.
// No modifica ningún punto: solo avisa.
// =====================================================================
import { ayerParaguay, errorSimple, esAdmin, esLlamadaProgramada, json, sql, usuarioActual, cabecerasCors } from '../_shared/base.ts';
import { listarActividadDelDia } from '../_shared/adaptador.ts';
import { calcularPuntos } from '../_shared/reglas.ts';
import { preguntarJSON } from '../_shared/claude.ts';
import { MANUAL_AUDITORIA } from '../_shared/manuales.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors(req) });

  // La llama la tarea programada, o un administrador con "Revisar ahora".
  let permitido = esLlamadaProgramada(req);
  if (!permitido) {
    const usuario = await usuarioActual(req);
    permitido = Boolean(usuario && (await esAdmin(usuario.id)));
  }
  if (!permitido) return errorSimple(req, 'No autorizado', 401);

  const cuerpo = await req.json().catch(() => ({}));
  const dia: string = /^\d{4}-\d{2}-\d{2}$/.test(cuerpo?.dia ?? '') ? cuerpo.dia : ayerParaguay();

  const actividades = await listarActividadDelDia(dia);
  let alertas = 0;
  const errores: string[] = [];

  for (const actividad of actividades) {
    const calculo = calcularPuntos(actividad);
    if (calculo.diferencia === 0 && calculo.sospechas.length === 0) continue;

    let motivo = calculo.diferencia !== 0
      ? `Diferencia de ${calculo.diferencia > 0 ? '+' : ''}${calculo.diferencia} pts entre lo registrado y lo calculado.`
      : 'Conductas a revisar.';
    try {
      const respuesta = await preguntarJSON<{ motivo: string }>({
        sistema: MANUAL_AUDITORIA,
        mensaje: JSON.stringify({
          alumno: actividad.nombre,
          dia,
          puntos_registrados: actividad.puntosRegistrados,
          puntos_calculados: calculo.total,
          diferencia: calculo.diferencia,
          calculo: calculo.lineas,
          subtotal_antes_del_tope: calculo.subtotalSinTopeAplicado,
          senales: calculo.sospechas,
        }),
        maxTokens: 300,
      });
      if (respuesta.motivo) motivo = respuesta.motivo;
    } catch (e) {
      // Si la IA falla, la alerta se guarda igual con el motivo básico.
      errores.push(`${actividad.nombre}: ${(e as Error).message}`);
    }

    await sql`
      insert into ia.alertas_ranking
        (alumno_id, alumno_nombre, dia, puntos_registrados, puntos_calculados, motivo, detalle, sospechas)
      values
        (${actividad.alumnoId}, ${actividad.nombre}, ${dia}, ${actividad.puntosRegistrados}, ${calculo.total},
         ${motivo}, ${sql.json(calculo as never)}, ${sql.json(calculo.sospechas)})
      on conflict (alumno_id, dia) do update set
        puntos_registrados = excluded.puntos_registrados,
        puntos_calculados  = excluded.puntos_calculados,
        motivo             = excluded.motivo,
        detalle            = excluded.detalle,
        sospechas          = excluded.sospechas
      where ia.alertas_ranking.estado = 'pendiente'
    `;
    alertas++;
  }

  return json(req, { dia, alumnos_revisados: actividades.length, alertas, errores });
});
