// Calendario del ranking: cada ranking mensual cierra el ÚLTIMO VIERNES del mes a las 23:59 (hora de Paraguay).
// Lo que se publica desde el sábado siguiente cuenta para el ranking del mes que viene.
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Último viernes del mes "AAAA-MM" → "AAAA-MM-DD".
export function ultimoViernes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const ult = new Date(Date.UTC(y, m, 0));
  const atras = (ult.getUTCDay() + 2) % 7; // viernes = 5
  return new Date(Date.UTC(y, m - 1, ult.getUTCDate() - atras)).toISOString().slice(0, 10);
}

// Mes ("AAAA-MM") del ranking que está corriendo en la fecha "AAAA-MM-DD" (hora PY).
export function mesDeRanking(hoy: string): string {
  const m = hoy.slice(0, 7);
  if (hoy <= ultimoViernes(m)) return m;
  const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
}

// Momento exacto del cierre: el sábado a las 00:00 de Paraguay (fin del viernes).
export function cierreISO(mes: string): string {
  const v = ultimoViernes(mes);
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) + "T00:00:00-03:00";
}

// "viernes 27 de noviembre"
export function textoFecha(f: string): string {
  const [y, m, d] = f.split("-").map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + " " + d + " de " + MESES[m - 1];
}
