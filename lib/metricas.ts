// Métricas del Journal a partir de las operaciones de una persona.
export type OpM = { fecha: string; par: string; resultado: number; cierre?: string | null; creado?: string };

export type Metricas = {
  n: number; ganadas: number; perdidas: number; tasa: number; neto: number;
  gananciaTotal: number; perdidaTotal: number; pf: number | null;
  promGanada: number; promPerdida: number; payoff: number | null; esperanza: number;
  mejor: number; peor: number; ddMax: number; rachaG: number; rachaP: number;
  curva: number[];
  porPar: { par: string; n: number; neto: number; tasa: number }[];
  porDia: { dia: string; n: number; neto: number }[];
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function calcular(ops: OpM[]): Metricas {
  const orden = [...ops].sort((a, b) => ((a.cierre || a.fecha) + (a.creado || "")).localeCompare((b.cierre || b.fecha) + (b.creado || "")));
  let neto = 0, gt = 0, pt = 0, g = 0, p = 0, pico = 0, dd = 0, rg = 0, rp = 0, mg = 0, mp = 0;
  const curva: number[] = [0];
  const pares = new Map<string, { n: number; neto: number; g: number }>();
  const dias = DIAS.map((d) => ({ dia: d, n: 0, neto: 0 }));
  for (const o of orden) {
    const r = o.resultado;
    neto += r;
    curva.push(Math.round(neto * 100) / 100);
    if (r > 0) { g++; gt += r; rg++; rp = 0; mg = Math.max(mg, rg); }
    else if (r < 0) { p++; pt += r; rp++; rg = 0; mp = Math.max(mp, rp); }
    else { rg = 0; rp = 0; }
    pico = Math.max(pico, neto);
    dd = Math.max(dd, pico - neto);
    const pr = pares.get(o.par) ?? { n: 0, neto: 0, g: 0 };
    pr.n++; pr.neto += r; if (r > 0) pr.g++;
    pares.set(o.par, pr);
    const dow = (new Date((o.cierre || o.fecha).slice(0, 10) + "T00:00:00Z").getUTCDay() + 6) % 7; // lunes = 0
    dias[dow].n++; dias[dow].neto += r;
  }
  const n = orden.length;
  return {
    n, ganadas: g, perdidas: p, tasa: n ? g / n : 0, neto,
    gananciaTotal: gt, perdidaTotal: pt, pf: pt < 0 ? gt / Math.abs(pt) : null,
    promGanada: g ? gt / g : 0, promPerdida: p ? pt / p : 0,
    payoff: g && p && pt < 0 ? (gt / g) / Math.abs(pt / p) : null,
    esperanza: n ? neto / n : 0,
    mejor: n ? Math.max(...orden.map((o) => o.resultado)) : 0,
    peor: n ? Math.min(...orden.map((o) => o.resultado)) : 0,
    ddMax: dd, rachaG: mg, rachaP: mp, curva,
    porPar: Array.from(pares, ([par, v]) => ({ par, n: v.n, neto: v.neto, tasa: v.g / v.n })).sort((a, b) => b.neto - a.neto),
    porDia: dias,
  };
}
