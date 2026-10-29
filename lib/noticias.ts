import { cookies } from "next/headers";

export type Ev = { title: string; country: string; date: string; impact: string; forecast: string; previous: string };

// Monedas disponibles en el filtro y las que se muestran por defecto (las que opera la academia).
export const TODAS = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
export const POR_DEFECTO = ["USD", "EUR", "GBP", "CAD"];

// Monedas que la persona eligió en el filtro de Noticias (cookie) o las de por defecto.
export function monedasElegidas(): string[] {
  const g = (cookies().get("noticias_monedas")?.value ?? "").split(/[.,]/).filter((m) => TODAS.includes(m));
  return g.length ? TODAS.filter((m) => g.includes(m)) : POR_DEFECTO;
}

export async function cargarCalendario(url: string): Promise<Ev[] | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j as Ev[]) : null;
  } catch { return null; }
}

export const URL_ESTA_SEMANA = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
export const URL_PROXIMA_SEMANA = "https://nfs.faireconomy.media/ff_calendar_nextweek.json";

// Noticias de alto impacto de las monedas elegidas que ocurren entre hace `atrasMin` minutos y dentro de `adelanteMin` minutos.
export async function noticiasCercanas(adelanteMin: number, atrasMin = 10): Promise<Ev[]> {
  const monedas = monedasElegidas();
  const [a, b] = await Promise.all([cargarCalendario(URL_ESTA_SEMANA), cargarCalendario(URL_PROXIMA_SEMANA)]);
  const ahora = Date.now();
  return [...(a ?? []), ...(b ?? [])]
    .filter((e) => e.impact === "High" && monedas.includes(e.country))
    .filter((e) => { const t = new Date(e.date).getTime(); return t >= ahora - atrasMin * 60000 && t <= ahora + adelanteMin * 60000; })
    .sort((x, y) => x.date.localeCompare(y.date));
}
