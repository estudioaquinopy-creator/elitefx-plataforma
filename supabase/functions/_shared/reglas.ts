// =====================================================================
// Motor de reglas de puntos de ELITE FX
// ---------------------------------------------------------------------
// El cálculo de puntos lo hace este código, no la IA: así es exacto y
// siempre da el mismo resultado. La IA solo explica las diferencias y
// señala conductas sospechosas.
// Si cambia el reglamento, se cambia en REGLAS (abajo) y en los manuales.
// =====================================================================

export const REGLAS = {
  topeDiario: 12,
  resultado: { puntos: 3, extraImagen: 1, maxPorDia: 2 },
  pregunta: { puntos: 2, maxPorDia: 2 },
  respuesta: { puntos: 1, minCaracteres: 20, maxPorDia: 5 },
  respuestaUtil: 5,
  meGusta: { puntos: 1, maxPorPublicacion: 10 },
  fotoPerfil: 5,
  cuentaLiquid: 20,
  certificado: 10,
  referido: { puntos: 10, maxPorMes: 10 },
  referidoVip: 30,
  // "Publicaciones muy cortas no suman": el ranking exige 15 caracteres entre título y texto
  // (publicaciones.titulo + publicaciones.cuerpo), salvo que lleve imagen (con imagen siempre suma).
  // Es el mismo número que usa la función ranking_mes_base_x de la plataforma.
  minCaracteresPublicacion: 15,
} as const;

export interface ActividadDia {
  alumnoId: string;
  nombre: string;
  dia: string; // AAAA-MM-DD, hora de Paraguay
  /** Publicaciones de resultado del día, en orden de creación (sin las eliminadas). */
  resultados: { id: string; conImagen: boolean; caracteres: number }[];
  /** Preguntas del día, en orden de creación (sin las eliminadas). */
  preguntas: { id: string; caracteres: number; conImagen?: boolean }[];
  /** Respuestas del día, en orden de creación (sin las eliminadas). */
  respuestas: {
    id: string;
    publicacionId: string;
    enPublicacionPropia: boolean;
    caracteres: number;
    /** true si ya había respondido esa publicación antes de este día */
    yaRespondidaAntes?: boolean;
  }[];
  /** Respuestas suyas marcadas como útiles ese día (por quien preguntó). */
  respuestasUtiles: number;
  /** Me gusta recibidos ese día, agrupados por publicación. */
  meGusta: {
    publicacionId: string;
    recibidos: number; // total recibidos ese día
    propios: number; // me gusta que se dio a sí mismo
    cuentasDistintas: number; // cuántas cuentas distintas dieron me gusta
  }[];
  fotoPerfil: boolean; // la subió ese día (primera vez)
  cuentaLiquid: boolean; // se confirmó ese día
  certificados: number; // aprobados ese día
  referidosActivados: number; // activados ese día
  referidosActivadosAntesEnElMes: number; // activados antes en el mismo mes
  referidosVip: number; // pasaron a VIP ese día
  /** Lo que la plataforma registró para ese día. */
  puntosRegistrados: number;
}

export interface LineaCalculo {
  concepto: string;
  detalle: string;
  puntos: number;
  cuentaParaTope: boolean;
}

export interface ResultadoCalculo {
  lineas: LineaCalculo[];
  subtotalConTope: number;
  subtotalSinTopeAplicado: number;
  extrasFueraDeTope: number;
  total: number;
  diferencia: number; // registrados - calculados
  sospechas: string[];
}

export function calcularPuntos(a: ActividadDia): ResultadoCalculo {
  const R = REGLAS;
  const lineas: LineaCalculo[] = [];

  // --- Resultados (máx. 2 puntuables) ---
  const resultadosValidos = a.resultados.filter((r) => r.conImagen || r.caracteres >= R.minCaracteresPublicacion);
  const resultadosPuntuables = resultadosValidos.slice(0, R.resultado.maxPorDia);
  const ptsResultados = resultadosPuntuables.reduce(
    (s, r) => s + R.resultado.puntos + (r.conImagen ? R.resultado.extraImagen : 0),
    0,
  );
  if (a.resultados.length) {
    lineas.push({
      concepto: 'Resultados publicados',
      detalle: `${a.resultados.length} publicados, ${resultadosPuntuables.length} puntuables (máx. ${R.resultado.maxPorDia}), ${resultadosPuntuables.filter((r) => r.conImagen).length} con captura`,
      puntos: ptsResultados,
      cuentaParaTope: true,
    });
  }

  // --- Preguntas (máx. 2 puntuables) ---
  const preguntasPuntuables = a.preguntas
    .filter((p) => p.conImagen || p.caracteres >= R.minCaracteresPublicacion)
    .slice(0, R.pregunta.maxPorDia);
  const ptsPreguntas = preguntasPuntuables.length * R.pregunta.puntos;
  if (a.preguntas.length) {
    lineas.push({
      concepto: 'Preguntas',
      detalle: `${a.preguntas.length} hechas, ${preguntasPuntuables.length} puntuables (máx. ${R.pregunta.maxPorDia})`,
      puntos: ptsPreguntas,
      cuentaParaTope: true,
    });
  }

  // --- Respuestas (primera por publicación, mín. 20 caracteres, máx. 5) ---
  const vistas = new Set<string>();
  const respuestasPuntuables = [];
  for (const r of a.respuestas) {
    if (r.enPublicacionPropia) continue;
    if (r.caracteres < R.respuesta.minCaracteres) continue;
    if (r.yaRespondidaAntes || vistas.has(r.publicacionId)) continue;
    vistas.add(r.publicacionId);
    respuestasPuntuables.push(r);
  }
  const respuestasContadas = respuestasPuntuables.slice(0, R.respuesta.maxPorDia);
  const ptsRespuestas = respuestasContadas.length * R.respuesta.puntos;
  if (a.respuestas.length) {
    lineas.push({
      concepto: 'Respuestas a otros',
      detalle: `${a.respuestas.length} escritas, ${respuestasPuntuables.length} válidas, ${respuestasContadas.length} contadas (máx. ${R.respuesta.maxPorDia})`,
      puntos: ptsRespuestas,
      cuentaParaTope: true,
    });
  }

  // --- Me gusta recibidos (sin los propios, máx. 10 por publicación) ---
  let ptsMeGusta = 0;
  let totalMeGusta = 0;
  for (const m of a.meGusta) {
    const validos = Math.max(0, m.recibidos - m.propios);
    totalMeGusta += m.recibidos;
    ptsMeGusta += Math.min(validos, R.meGusta.maxPorPublicacion) * R.meGusta.puntos;
  }
  if (a.meGusta.length) {
    lineas.push({
      concepto: 'Me gusta recibidos',
      detalle: `${totalMeGusta} recibidos en ${a.meGusta.length} publicación(es), máx. ${R.meGusta.maxPorPublicacion} por publicación, sin contar los propios`,
      puntos: ptsMeGusta,
      cuentaParaTope: true,
    });
  }

  const subtotalSinTopeAplicado = ptsResultados + ptsPreguntas + ptsRespuestas + ptsMeGusta;
  const subtotalConTope = Math.min(subtotalSinTopeAplicado, R.topeDiario);

  // --- Fuera del tope diario ---
  const extra = (concepto: string, detalle: string, puntos: number) => {
    if (puntos > 0) lineas.push({ concepto, detalle, puntos, cuentaParaTope: false });
    return puntos;
  };
  let extras = 0;
  extras += extra('Respuestas útiles', `${a.respuestasUtiles} marcadas por quien preguntó`, a.respuestasUtiles * R.respuestaUtil);
  extras += extra('Foto de perfil', 'Una sola vez', a.fotoPerfil ? R.fotoPerfil : 0);
  extras += extra('Cuenta de Liquid', 'Una sola vez, confirmada', a.cuentaLiquid ? R.cuentaLiquid : 0);
  extras += extra('Certificados', `${a.certificados} aprobado(s)`, a.certificados * R.certificado);
  const cupoReferidos = Math.max(0, R.referido.maxPorMes - a.referidosActivadosAntesEnElMes);
  const referidosContados = Math.min(a.referidosActivados, cupoReferidos);
  extras += extra(
    'Referidos activados',
    `${a.referidosActivados} activado(s), ${referidosContados} contados (máx. ${R.referido.maxPorMes} al mes)`,
    referidosContados * R.referido.puntos,
  );
  extras += extra('Referidos VIP', `${a.referidosVip} pasaron a VIP`, a.referidosVip * R.referidoVip);

  const total = subtotalConTope + extras;

  // --- Señales para revisar (indicios, no pruebas) ---
  const sospechas: string[] = [];
  for (const m of a.meGusta) {
    if (m.recibidos >= 8 && m.cuentasDistintas <= 3) {
      sospechas.push(`Publicación ${m.publicacionId}: ${m.recibidos} me gusta de solo ${m.cuentasDistintas} cuenta(s). Posibles me gusta cruzados.`);
    }
    if (m.propios > 0) {
      sospechas.push(`Publicación ${m.publicacionId}: se dio ${m.propios} me gusta a sí mismo/a.`);
    }
  }
  const respuestasJustas = a.respuestas.filter(
    (r) => r.caracteres >= R.respuesta.minCaracteres && r.caracteres <= R.respuesta.minCaracteres + 5,
  ).length;
  if (respuestasJustas >= 3) {
    sospechas.push(`${respuestasJustas} respuestas apenas por encima del mínimo de ${R.respuesta.minCaracteres} caracteres. Posibles respuestas de relleno.`);
  }
  const propias = a.respuestas.filter((r) => r.enPublicacionPropia).length;
  if (propias > 0) sospechas.push(`${propias} respuesta(s) en sus propias publicaciones (no suman).`);
  if (a.resultados.length > R.resultado.maxPorDia * 2) {
    sospechas.push(`${a.resultados.length} resultados publicados en un día. Revisar que sean operaciones distintas y reales.`);
  }

  return {
    lineas,
    subtotalConTope,
    subtotalSinTopeAplicado,
    extrasFueraDeTope: extras,
    total,
    diferencia: a.puntosRegistrados - total,
    sospechas,
  };
}
