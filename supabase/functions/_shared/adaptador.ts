// =====================================================================
// ADAPTADOR · El único archivo que conoce las tablas de la plataforma
// ---------------------------------------------------------------------
// Aquí están TODAS las consultas a las tablas existentes. Son SOLO DE
// LECTURA (select): este paquete nunca escribe, modifica ni borra datos
// existentes.
//
// TABLAS REALES DE LA PLATAFORMA QUE SE LEEN
//   perfiles        (id, nombre, email, rol, plan, vence, es_alumno, prueba_hasta,
//                    referido_por, vip_desde, avatar_desde)
//   publicaciones   (id, user_id, canal 'resultados'|'preguntas'|…, titulo, cuerpo,
//                    imagen_url, created_at)            ← se borran de verdad (no hay "eliminado_en")
//   comentarios     (id, post_id, user_id, cuerpo, util, created_at)   ← las respuestas
//   likes           (post_id, user_id, created_at)
//   certificados    (user_id, emitido_at)
//   liquid_cuentas  (user_id, estado, revisado_at)
//   progreso        (user_id, completada_at)            ← la primera lección activa al referido
//
// IMPORTANTE · PUNTOS REGISTRADOS
// La plataforma NO guarda los puntos en una tabla: los calcula al vuelo con
// SQL (ranking_mes_base_x). Por eso "lo que registró la plataforma" se lee de
// public.ranking_detalle(mes, alumno), la misma función que usa la pantalla
// "Revisar" del ranking. Solo la puede ejecutar un administrador, así que
// cada lectura se hace con la identidad de un administrador de
// ia.administradores (solo dentro de esa transacción). Es de lectura: no
// cambia nada.
//
// Todas las fechas se comparan en hora de Paraguay (America/Asuncion).
// =====================================================================
import { sql } from './base.ts';
import type { ActividadDia } from './reglas.ts';

const TZ = 'America/Asuncion';

interface FilaDetalle {
  tipo: string;
  dia: string | null;
  pts: number;
  otro: string | null;
}

/** Mes del ranking ("AAAA-MM") al que pertenece una fecha (el mes cierra el último viernes). */
export async function mesDeRankingParaDia(dia: string): Promise<string> {
  const [r] = await sql<{ mes: string }[]>`
    select case
      when ${dia}::date <= public.ranking_cierre(to_char(${dia}::date, 'YYYY-MM')) then to_char(${dia}::date, 'YYYY-MM')
      else to_char(${dia}::date + interval '1 month', 'YYYY-MM')
    end as mes
  `;
  return r.mes;
}

/**
 * Detalle de puntos de UN alumno en un mes, tal como lo calcula la plataforma
 * (tope diario, límites, ajustes, penalización). Vacío si esa persona no
 * participa en el ranking ese mes (gratuito, prueba, administrador).
 */
async function detalleRanking(mes: string, alumnoId: string): Promise<FilaDetalle[]> {
  const [admin] = await sql<{ user_id: string }[]>`select user_id from ia.administradores order by creado_en limit 1`;
  if (!admin) throw new Error('No hay administradores en ia.administradores: hace falta uno para leer el detalle del ranking.');
  return await sql.begin(async (tx) => {
    // Solo dentro de esta transacción: identidad de administrador para que ranking_detalle lo permita.
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: admin.user_id, role: 'authenticated' })}, true)`;
    return await tx<FilaDetalle[]>`
      select d.tipo, d.dia::text as dia, d.pts::float8 as pts, d.otro
      from public.ranking_detalle(${mes}, ${alumnoId}::uuid) d
    `;
  }) as unknown as FilaDetalle[];
}

/** Puntos que la plataforma sumó a ese alumno en ese día (sin ajustes manuales, redondeo ni penalización). */
async function puntosRegistradosDelDia(alumnoId: string, dia: string): Promise<number> {
  const mes = await mesDeRankingParaDia(dia);
  const filas = await detalleRanking(mes, alumnoId);
  const total = filas
    .filter((f) => f.dia === dia && !['ajuste', 'redondeo', 'penal'].includes(f.tipo))
    .reduce((s, f) => s + Number(f.pts), 0);
  return Math.round(total);
}

/** Actividad de cada alumno que participa en el ranking y hizo algo ese día. */
export async function listarActividadDelDia(dia: string): Promise<ActividadDia[]> {
  // Personas con alguna actividad ese día que cuentan para el ranking (mismas condiciones que ranking_mes_base_x).
  const alumnos = await sql<{ id: string; nombre: string }[]>`
    with act as (
      select p.user_id as uid from public.publicaciones p where (p.created_at at time zone ${TZ})::date = ${dia}::date
      union select c.user_id from public.comentarios c where (c.created_at at time zone ${TZ})::date = ${dia}::date
      union select p.user_id from public.likes l join public.publicaciones p on p.id = l.post_id
        where (l.created_at at time zone ${TZ})::date = ${dia}::date
      union select ce.user_id from public.certificados ce where (ce.emitido_at at time zone ${TZ})::date = ${dia}::date
      union select li.user_id from public.liquid_cuentas li
        where li.estado = 'aprobado' and (li.revisado_at at time zone ${TZ})::date = ${dia}::date
      union select pf.id from public.perfiles pf where (pf.avatar_desde at time zone ${TZ})::date = ${dia}::date
      union select pf.referido_por from public.perfiles pf
        where pf.referido_por is not null and (pf.vip_desde at time zone ${TZ})::date = ${dia}::date
      union select pf.referido_por from public.perfiles pf
        where pf.referido_por is not null
          and ((select min(g.completada_at) from public.progreso g where g.user_id = pf.id) at time zone ${TZ})::date = ${dia}::date
    )
    select pf.id::text as id, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nombre
    from public.perfiles pf join act on act.uid = pf.id
    where pf.rol <> 'admin' and pf.prueba_hasta is null
      and ((pf.plan <> 'gratis' and (pf.vence is null or pf.vence >= ia.inicio_mes(${dia}::date)))
           or (pf.es_alumno and pf.vence is not null and pf.vence >= ia.inicio_mes(${dia}::date)))
    order by nombre
  `;

  const resultado: ActividadDia[] = [];
  for (const al of alumnos) {
    const [pubs, resps, utiles, likes, extras, registrados] = await Promise.all([
      // Publicaciones de preguntas y resultados del día. "caracteres" = título + texto (como cuenta el ranking).
      sql<{ id: string; canal: string; caracteres: number; con_imagen: boolean }[]>`
        select p.id::text as id, p.canal::text as canal,
               (length(btrim(p.cuerpo)) + length(btrim(p.titulo)))::int as caracteres,
               (p.imagen_url is not null) as con_imagen
        from public.publicaciones p
        where p.user_id = ${al.id}::uuid and p.canal in ('preguntas', 'resultados')
          and (p.created_at at time zone ${TZ})::date = ${dia}::date
        order by p.created_at
      `,
      // Respuestas del día. "antes" = ya tenía una respuesta válida (20+ caracteres) en esa publicación en un día anterior.
      sql<{ id: string; publicacion_id: string; caracteres: number; propia: boolean; antes: boolean }[]>`
        select c.id::text as id, c.post_id::text as publicacion_id, length(btrim(c.cuerpo))::int as caracteres,
               (p.user_id = c.user_id) as propia,
               exists (
                 select 1 from public.comentarios c2
                 where c2.post_id = c.post_id and c2.user_id = c.user_id and length(btrim(c2.cuerpo)) >= 20
                   and (c2.created_at at time zone ${TZ})::date < ${dia}::date
               ) as antes
        from public.comentarios c join public.publicaciones p on p.id = c.post_id
        where c.user_id = ${al.id}::uuid and (c.created_at at time zone ${TZ})::date = ${dia}::date
        order by c.created_at
      `,
      // Respuestas útiles: la plataforma las fecha con el día en que se escribió la respuesta (una por publicación).
      sql<{ n: number }[]>`
        select count(*)::int as n from (
          select c.created_at,
                 row_number() over (partition by c.user_id, c.post_id order by c.created_at) as ru
          from public.comentarios c join public.publicaciones p on p.id = c.post_id
          where c.user_id = ${al.id}::uuid and c.util and c.user_id <> p.user_id
        ) u
        where u.ru = 1 and (u.created_at at time zone ${TZ})::date = ${dia}::date
      `,
      // Me gusta recibidos ese día. La plataforma solo cuenta los 10 primeros de cada publicación (contando los propios).
      sql<{ publicacion_id: string; recibidos: number; propios: number; cuentas: number }[]>`
        select x.post_id::text as publicacion_id,
               count(*) filter (where x.rn <= 10)::int as recibidos,
               count(*) filter (where x.rn <= 10 and x.es_propio)::int as propios,
               count(distinct x.user_id) filter (where x.rn <= 10)::int as cuentas
        from (
          select l.post_id, l.user_id, l.created_at, (l.user_id = p.user_id) as es_propio,
                 row_number() over (partition by l.post_id order by l.created_at) as rn
          from public.likes l join public.publicaciones p on p.id = l.post_id
          where p.user_id = ${al.id}::uuid and p.canal in ('preguntas', 'resultados')
        ) x
        where (x.created_at at time zone ${TZ})::date = ${dia}::date
        group by x.post_id
        having count(*) filter (where x.rn <= 10) > 0
      `,
      sql<{
        foto: boolean; liquid: boolean; certificados: number;
        ref_dia: number; ref_antes: number; vip: number;
      }[]>`
        select
          exists (select 1 from public.perfiles where id = ${al.id}::uuid
                  and (avatar_desde at time zone ${TZ})::date = ${dia}::date) as foto,
          exists (select 1 from public.liquid_cuentas where user_id = ${al.id}::uuid and estado = 'aprobado'
                  and (revisado_at at time zone ${TZ})::date = ${dia}::date) as liquid,
          (select count(*)::int from public.certificados where user_id = ${al.id}::uuid
                  and (emitido_at at time zone ${TZ})::date = ${dia}::date) as certificados,
          (select count(*)::int from public.perfiles r
             where r.referido_por = ${al.id}::uuid
               and ((select min(g.completada_at) from public.progreso g where g.user_id = r.id) at time zone ${TZ})::date = ${dia}::date) as ref_dia,
          (select count(*)::int from public.perfiles r
             where r.referido_por = ${al.id}::uuid
               and ((select min(g.completada_at) from public.progreso g where g.user_id = r.id) at time zone ${TZ})::date >= ia.inicio_mes(${dia}::date)
               and ((select min(g.completada_at) from public.progreso g where g.user_id = r.id) at time zone ${TZ})::date < ${dia}::date) as ref_antes,
          (select count(*)::int from public.perfiles r
             where r.referido_por = ${al.id}::uuid and r.plan <> 'gratis'
               and (r.vip_desde at time zone ${TZ})::date = ${dia}::date) as vip
      `,
      puntosRegistradosDelDia(al.id, dia),
    ]);

    resultado.push({
      alumnoId: al.id,
      nombre: al.nombre,
      dia,
      resultados: pubs.filter((p) => p.canal === 'resultados')
        .map((p) => ({ id: p.id, conImagen: p.con_imagen, caracteres: p.caracteres })),
      preguntas: pubs.filter((p) => p.canal === 'preguntas')
        .map((p) => ({ id: p.id, caracteres: p.caracteres, conImagen: p.con_imagen })),
      respuestas: resps.map((r) => ({
        id: r.id, publicacionId: r.publicacion_id, enPublicacionPropia: r.propia,
        caracteres: r.caracteres, yaRespondidaAntes: r.antes,
      })),
      respuestasUtiles: utiles[0]?.n ?? 0,
      meGusta: likes.map((l) => ({
        publicacionId: l.publicacion_id, recibidos: l.recibidos, propios: l.propios, cuentasDistintas: l.cuentas,
      })),
      fotoPerfil: extras[0].foto,
      cuentaLiquid: extras[0].liquid,
      certificados: extras[0].certificados,
      referidosActivados: extras[0].ref_dia,
      referidosActivadosAntesEnElMes: extras[0].ref_antes,
      referidosVip: extras[0].vip,
      puntosRegistrados: registrados,
    });
  }
  return resultado;
}

export interface TextoNuevo {
  origenTabla: 'publicacion' | 'respuesta';
  origenId: string;
  alumnoId: string;
  alumnoNombre: string;
  texto: string;
  creadoEn: Date;
}

/** Publicaciones y respuestas de miembros (no de administradores) creadas después de "desde". */
export async function listarTextosNuevos(desde: Date, limite: number): Promise<TextoNuevo[]> {
  const filas = await sql<{
    origen: 'publicacion' | 'respuesta'; id: string; autor: string; nombre: string; texto: string; creado: Date;
  }[]>`
    select * from (
      -- date_trunc a milisegundos: misma precisión que las fechas de JavaScript
      select 'publicacion' as origen, x.id::text as id, x.user_id::text as autor,
             coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1)) as nombre,
             (case when btrim(x.titulo) <> '' then btrim(x.titulo) || E'\n' || x.cuerpo else x.cuerpo end) as texto,
             date_trunc('milliseconds', x.created_at) as creado
      from public.publicaciones x join public.perfiles p on p.id = x.user_id
      where date_trunc('milliseconds', x.created_at) > ${desde} and p.rol <> 'admin'
      union all
      select 'respuesta', x.id::text, x.user_id::text,
             coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1)), x.cuerpo,
             date_trunc('milliseconds', x.created_at)
      from public.comentarios x join public.perfiles p on p.id = x.user_id
      where date_trunc('milliseconds', x.created_at) > ${desde} and p.rol <> 'admin'
    ) t
    order by creado, origen, id
    limit ${limite}
  `;
  return filas.map((f) => ({
    origenTabla: f.origen, origenId: f.id, alumnoId: f.autor, alumnoNombre: f.nombre, texto: f.texto, creadoEn: f.creado,
  }));
}

/** Algunos textos anteriores del alumno, para comparar su estilo habitual. */
export async function textosAnteriores(alumnoId: string, antesDe: Date, cantidad = 3): Promise<string[]> {
  const filas = await sql<{ texto: string }[]>`
    select cuerpo as texto from public.publicaciones
    where user_id = ${alumnoId}::uuid and created_at < ${antesDe}
      and char_length(cuerpo) >= 60
    order by created_at desc
    limit ${cantidad}
  `;
  return filas.map((f) => f.texto);
}

const ETIQUETA_TIPO: Record<string, string> = {
  resultados: 'resultado publicado',
  preguntas: 'pregunta publicada',
  respuesta: 'respuesta a otra persona',
  util: 'respuesta marcada como útil',
  like: 'me gusta recibido',
  certificado: 'certificado',
  ref: 'referido activado',
  refvip: 'referido pasó a VIP',
  foto: 'foto de perfil',
  liquid: 'cuenta de Liquid confirmada',
  liquidreal: 'cuenta de Liquid operando en real',
  ajuste: 'ajuste del equipo',
  redondeo: 'redondeo',
  penal: 'descuento por haber sido Top 3 el mes anterior',
};

/**
 * Resumen de la cuenta de UN alumno, para el asistente de soporte.
 * Solo datos de ese alumno. NUNCA incluir alertas ni revisiones de IA,
 * ni los nombres de otras personas (por ejemplo, quién dio un me gusta).
 */
export async function resumenAlumno(alumnoId: string): Promise<string> {
  const [perfil] = await sql<{ nombre: string }[]>`
    select coalesce(nullif(btrim(nombre), ''), split_part(email, '@', 1)) as nombre
    from public.perfiles where id = ${alumnoId}::uuid
  `;
  const [calendario] = await sql<{ hoy: string; inicio: string; cierre: string }[]>`
    select to_char((now() at time zone ${TZ})::date, 'YYYY-MM-DD') as hoy,
           to_char(ia.inicio_mes((now() at time zone ${TZ})::date), 'DD/MM/YYYY') as inicio,
           to_char(ia.cierre_mes((now() at time zone ${TZ})::date), 'DD/MM/YYYY') as cierre
  `;
  const mes = await mesDeRankingParaDia(calendario.hoy);
  const filas = await detalleRanking(mes, alumnoId);

  const lineas = [
    `Alumno: ${perfil?.nombre ?? 'desconocido'}`,
    `Mes de ranking actual: empezó el ${calendario.inicio} y cierra el viernes ${calendario.cierre} a las 23:59 (hora de Paraguay)`,
  ];

  if (!filas.length) {
    lineas.push('Esta persona todavía no suma puntos este mes (o su plan no participa en el ranking: solo participan los miembros VIP).');
    return lineas.join('\n');
  }

  const hoy = Math.round(
    filas.filter((f) => f.dia === calendario.hoy && !['ajuste', 'redondeo', 'penal'].includes(f.tipo))
      .reduce((s, f) => s + Number(f.pts), 0),
  );
  const mesTotal = Math.round(filas.reduce((s, f) => s + Number(f.pts), 0));
  lineas.push(`Puntos de hoy: ${hoy} (tope diario 12 para las actividades que cuentan)`);
  lineas.push(`Puntos del mes actual: ${mesTotal}`);
  lineas.push('Últimos movimientos de puntos (agrupados por día y tipo):');

  const grupos = new Map<string, { dia: string; tipo: string; n: number; pts: number; nota: string }>();
  for (const f of filas.filter((x) => x.dia)) {
    const clave = `${f.dia}|${f.tipo}`;
    const g = grupos.get(clave) ?? { dia: f.dia as string, tipo: f.tipo, n: 0, pts: 0, nota: '' };
    g.n++;
    g.pts += Number(f.pts);
    // Solo el motivo de un ajuste del equipo se muestra; en los demás casos "otro" puede traer nombres de terceros.
    if (f.tipo === 'ajuste' && f.otro) g.nota = f.otro;
    grupos.set(clave, g);
  }
  const recientes = [...grupos.values()].sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 15);
  for (const g of recientes) {
    const [, m, d] = g.dia.split('-');
    const signo = g.pts > 0 ? '+' : '';
    lineas.push(`- ${d}/${m}: ${signo}${Math.round(g.pts * 10) / 10} (${g.n} × ${ETIQUETA_TIPO[g.tipo] ?? g.tipo}${g.nota ? `: ${g.nota}` : ''})`);
  }
  if (filas.some((f) => f.tipo === 'penal')) {
    lineas.push('Este mes tiene un descuento por haber estado en el Top 3 del mes anterior.');
  }
  return lineas.join('\n');
}

/** Nombres de varios alumnos a la vez (para mostrarlos en el panel). */
export async function nombresDeAlumnos(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const filas = await sql<{ id: string; nombre: string }[]>`
    select id::text as id, coalesce(nullif(btrim(nombre), ''), split_part(email, '@', 1)) as nombre
    from public.perfiles where id = any(${ids}::uuid[])
  `;
  return Object.fromEntries(filas.map((f) => [f.id, f.nombre]));
}

/**
 * ¿Puede usar el asistente? Administradores y miembros VIP vigentes (mismo criterio que la pestaña
 * Comunidad, a la que acompaña el enlace del menú). Los gratuitos no, para controlar el gasto.
 */
export async function puedeUsarAsistente(userId: string): Promise<boolean> {
  const filas = await sql`
    select 1 from public.perfiles
    where id = ${userId}::uuid
      and (rol = 'admin' or (plan <> 'gratis' and (vence is null or vence >= (now() at time zone ${TZ})::date)))
    limit 1
  `;
  return filas.length > 0;
}
