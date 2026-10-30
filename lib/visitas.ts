// Visitas a las oficinas: solo miércoles, turnos de 1 hora entre las 8:00 y las 17:00 (el último empieza a las 16:00).
export const HORAS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
export const TEMAS = ["Cargar brokers", "Configurar MetaTrader", "Dudas de la estrategia", "Revisar mi operativa", "Otro"];

// Próximos miércoles a partir de mañana (hoy = "YYYY-MM-DD" hora de Paraguay).
export function proximosMiercoles(hoy: string, n = 8): string[] {
  const [y, m, d] = hoy.split("-").map(Number);
  const out: string[] = [];
  for (let i = 1; out.length < n && i < 120; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    if (dt.getUTCDay() === 3) out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export function fechaLarga(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

export const horaCorta = (h: string) => h.slice(0, 5);

// Número de WhatsApp en formato internacional (Paraguay por defecto).
export function whatsapp(tel: string | null | undefined): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("595")) return d;
  if (d.startsWith("0")) return "595" + d.slice(1);
  return d.length <= 9 ? "595" + d : d;
}
