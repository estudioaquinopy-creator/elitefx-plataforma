// Sala de trading en vivo: horario fijo todos los días (hora de Paraguay). Si lo cambias, cámbialo también en la migración 0060 (función `sala_validar`).
export const SALA_DESDE = "06:00";
export const SALA_HASTA = "23:30";
export const SALA_HORAS_HISTORIAL = 24;

// ¿La sala está abierta ahora? (hora de Paraguay)
export function salaAbierta(ahora: Date = new Date()): boolean {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false }).format(ahora);
  return hm >= SALA_DESDE && hm <= SALA_HASTA;
}
