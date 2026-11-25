// Pruebas del motor de reglas con los casos usados en el playground.
// Ejecutar:  node --experimental-strip-types ia/pruebas/reglas.test.ts
//      o:    deno run ia/pruebas/reglas.test.ts   
import { calcularPuntos, type ActividadDia } from '../../functions/_shared/reglas.ts';

let fallos = 0;
function igual(nombre: string, obtenido: unknown, esperado: unknown) {
  const ok = obtenido === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}: obtenido ${obtenido}, esperado ${esperado}`);
}

const base: ActividadDia = {
  alumnoId: 'a1', nombre: 'Alumno', dia: '2026-11-24',
  resultados: [], preguntas: [], respuestas: [], respuestasUtiles: 0, meGusta: [],
  fotoPerfil: false, cuentaLiquid: false, certificados: 0,
  referidosActivados: 0, referidosActivadosAntesEnElMes: 0, referidosVip: 0,
  puntosRegistrados: 0,
};

// Caso 1: Pedro Gómez (el del playground) -> 17 pts, sistema 40, diferencia +23
const pedro = calcularPuntos({
  ...base, nombre: 'Pedro Gómez', puntosRegistrados: 40,
  resultados: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, conImagen: true, caracteres: 120 })),
  respuestas: Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, publicacionId: `p${i}`, enPublicacionPropia: false, caracteres: 60 })),
  meGusta: [{ publicacionId: 'r0', recibidos: 15, propios: 0, cuentasDistintas: 15 }],
  respuestasUtiles: 1,
});
igual('Pedro total', pedro.total, 17);
igual('Pedro diferencia', pedro.diferencia, 23);
igual('Pedro subtotal con tope', pedro.subtotalConTope, 12);

// Respuestas: solo la primera por publicación, nunca en la propia, mínimo 20 caracteres
const resp = calcularPuntos({
  ...base,
  respuestas: [
    { id: '1', publicacionId: 'A', enPublicacionPropia: false, caracteres: 30 },
    { id: '2', publicacionId: 'A', enPublicacionPropia: false, caracteres: 30 }, // segunda en A
    { id: '3', publicacionId: 'B', enPublicacionPropia: true, caracteres: 30 }, // propia
    { id: '4', publicacionId: 'C', enPublicacionPropia: false, caracteres: 19 }, // corta
    { id: '5', publicacionId: 'D', enPublicacionPropia: false, caracteres: 20 },
  ],
});
igual('Respuestas válidas', resp.total, 2);

// Me gusta: máx. 10 por publicación y sin contar los propios
const likes = calcularPuntos({
  ...base,
  meGusta: [
    { publicacionId: 'A', recibidos: 4, propios: 1, cuentasDistintas: 4 },
    { publicacionId: 'B', recibidos: 30, propios: 0, cuentasDistintas: 30 },
  ],
});
igual('Me gusta (3 + tope 10 = 13 -> tope diario 12)', likes.total, 12);

// Fuera del tope: certificado + Liquid + foto + referidos
const extras = calcularPuntos({
  ...base,
  preguntas: [{ id: 'q1', caracteres: 80 }, { id: 'q2', caracteres: 80 }, { id: 'q3', caracteres: 80 }],
  certificados: 1, cuentaLiquid: true, fotoPerfil: true,
  referidosActivados: 3, referidosActivadosAntesEnElMes: 9, referidosVip: 1,
});
// preguntas 4 + certificado 10 + Liquid 20 + foto 5 + referidos 1x10 (cupo 1) + VIP 30 = 79
igual('Extras fuera del tope', extras.total, 79);

// Sospecha de me gusta cruzados
const cruzados = calcularPuntos({
  ...base, meGusta: [{ publicacionId: 'Z', recibidos: 15, propios: 0, cuentasDistintas: 3 }],
});
igual('Detecta me gusta cruzados', cruzados.sospechas.length > 0, true);

// Publicaciones cortas: mínimo 15 caracteres (título + texto), salvo que lleven imagen
const cortas = calcularPuntos({
  ...base,
  preguntas: [{ id: 'q1', caracteres: 14 }, { id: 'q2', caracteres: 15 }, { id: 'q3', caracteres: 5, conImagen: true }],
  resultados: [{ id: 'r1', caracteres: 14, conImagen: false }, { id: 'r2', caracteres: 3, conImagen: true }],
});
// preguntas: q2 (2) + q3 con imagen (2) = 4 ; resultados: r2 con imagen = 3 + 1 = 4 ; total 8
igual('Publicaciones cortas (15 caracteres o imagen)', cortas.total, 8);

// Respuesta válida ya hecha en un día anterior en la misma publicación: no suma otra vez
const antes = calcularPuntos({
  ...base,
  respuestas: [{ id: 'x', publicacionId: 'A', enPublicacionPropia: false, caracteres: 40, yaRespondidaAntes: true }],
});
igual('Segunda respuesta en otro día no suma', antes.total, 0);

if (fallos) {
  console.error(`\n${fallos} prueba(s) fallaron`);
  (globalThis as any).process?.exit?.(1);
} else {
  console.log('\nTodas las pruebas pasaron');
}
