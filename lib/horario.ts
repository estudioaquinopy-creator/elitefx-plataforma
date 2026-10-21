// Sesiones fijas semanales → ocurrencias reales (hora de Paraguay, UTC-3).
export type Fijo = { id: string; titulo: string; dias: number[]; hora: string; activo: boolean; zoom_url: string; duracion_min?: number };
export type Ocurrencia = { id: string; titulo: string; inicio: string; zoom_url: string; fijo: boolean; duracion_min: number };

// Desde la fecha "YYYY-MM-DD" (hora PY) durante `n` días.
export function ocurrencias(fijos: Fijo[], desde: string, n: number): Ocurrencia[] {
  const [y, m, d] = desde.split("-").map(Number);
  const out: Ocurrencia[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const wd = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
    const fecha = dt.toISOString().slice(0, 10);
    for (const f of fijos) {
      if (!f.activo || !f.dias.includes(wd)) continue;
      out.push({ id: "f-" + f.id + "-" + fecha, titulo: f.titulo, inicio: new Date(fecha + "T" + f.hora.slice(0, 5) + ":00-03:00").toISOString(), zoom_url: f.zoom_url, fijo: true, duracion_min: f.duracion_min ?? 90 });
    }
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
