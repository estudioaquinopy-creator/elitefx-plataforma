// Recomendaciones personalizadas a partir del historial del Journal. Son reglas fijas (sin IA ni costo): se calculan en el servidor con los datos de la propia persona.
import type { Metricas } from "./metricas";

export type OpC = { fecha: string; par: string; resultado: number; apertura?: string | null; cierre?: string | null; direccion?: string; plan?: boolean | null; emocion?: string | null };
export type Consejo = { nivel: "alerta" | "consejo" | "ok"; titulo: string; texto: string };

type Fmt = { mp: (x: number) => string; pc: (x: number) => string };
type Acc = { n: number; neto: number; g: number };

function agrupa(ops: OpC[], clave: (o: OpC) => string | null): Map<string, Acc> {
  const mapa = new Map<string, Acc>();
  for (const o of ops) {
    const k = clave(o);
    if (!k) continue;
    const v = mapa.get(k) ?? { n: 0, neto: 0, g: 0 };
    v.n++; v.neto += o.resultado; if (o.resultado > 0) v.g++;
    mapa.set(k, v);
  }
  return mapa;
}

const MIN = 5; // mínimo de operaciones para opinar sobre un grupo
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function generarConsejos(ops: OpC[], m: Metricas, capital: number, f: Fmt): Consejo[] {
  const out: Consejo[] = [];
  const pt = Math.abs(m.perdidaTotal) || 1;
  const pct = (x: number) => Math.round(x * 100) + "%";
  const peores = (mapa: Map<string, Acc>) => Array.from(mapa, ([k, v]) => ({ k, ...v })).filter((x) => x.n >= MIN && x.neto < 0 && Math.abs(x.neto) >= 0.1 * pt).sort((a, b) => a.neto - b.neto);
  const mejores = (mapa: Map<string, Acc>) => Array.from(mapa, ([k, v]) => ({ k, ...v })).filter((x) => x.n >= MIN && x.neto > 0).sort((a, b) => b.neto - a.neto);

  // 1) Horarios (hora de entrada según el reporte del broker: solo operaciones importadas)
  const hora = (o: OpC) => { const t = o.apertura || o.cierre; return t && t.length >= 13 ? t.slice(11, 13) : null; };
  const porHora = agrupa(ops, hora);
  const conHora = Array.from(porHora.values()).reduce((a, v) => a + v.n, 0);
  if (conHora >= 20) {
    const malo = peores(porHora)[0];
    if (malo) out.push({ nivel: "alerta", titulo: "Evita o reduce tu actividad entre las " + malo.k + ":00 y las " + malo.k + ":59", texto: "Es la franja donde más dinero pierdes: " + malo.n + " operaciones, " + f.mp(malo.neto) + " y " + pct(malo.g / malo.n) + " de aciertos. Prueba no operar en ese horario (o usar menos riesgo) durante unas semanas y compara. La hora es la del servidor de tu broker, tal como aparece en tu reporte." });
    const bueno = mejores(porHora)[0];
    if (bueno) out.push({ nivel: "ok", titulo: "Tu mejor franja: " + bueno.k + ":00 a " + bueno.k + ":59", texto: bueno.n + " operaciones con " + f.mp(bueno.neto) + " y " + pct(bueno.g / bueno.n) + " de aciertos. Concentra ahí tu atención y tus mejores setups." });
  }

  // 2) Pares
  const porPar = agrupa(ops, (o) => o.par);
  const parMalo = peores(porPar)[0];
  if (parMalo) out.push({ nivel: "alerta", titulo: "Revisa si deberías seguir operando " + parMalo.k, texto: "Es tu par con más pérdidas: " + parMalo.n + " operaciones, " + f.mp(parMalo.neto) + " (" + pct(parMalo.g / parMalo.n) + " de aciertos). Considera dejarlo de lado o operarlo solo con setups muy claros, y enfocarte en los pares donde sí tienes ventaja." });
  const parBueno = mejores(porPar)[0];
  if (parBueno) out.push({ nivel: "ok", titulo: "Tu par más rentable: " + parBueno.k, texto: parBueno.n + " operaciones, " + f.mp(parBueno.neto) + " y " + pct(parBueno.g / parBueno.n) + " de aciertos. Es donde tu estilo mejor funciona." });

  // 3) Día de la semana
  const porDia = agrupa(ops, (o) => String((new Date(o.fecha.slice(0, 10) + "T00:00:00Z").getUTCDay() + 6) % 7));
  const diaMalo = peores(porDia)[0];
  if (diaMalo) out.push({ nivel: "consejo", titulo: "Cuidado con los " + DIAS[Number(diaMalo.k)], texto: "Es tu día más débil: " + diaMalo.n + " operaciones, " + f.mp(diaMalo.neto) + " (" + pct(diaMalo.g / diaMalo.n) + " de aciertos). Opera menos o con más filtro ese día." });

  // 4) Dirección
  const porDir = agrupa(ops, (o) => (o.direccion === "compra" ? "compras" : o.direccion === "venta" ? "ventas" : null));
  const dirMala = peores(porDir)[0];
  if (dirMala && porDir.size === 2) out.push({ nivel: "consejo", titulo: "Tus " + dirMala.k + " te están restando", texto: dirMala.n + " operaciones con " + f.mp(dirMala.neto) + " (" + pct(dirMala.g / dirMala.n) + " de aciertos). Revisa tu criterio de entrada en ese lado o inclínate hacia donde eres más efectivo." });

  // 5) Sobreoperar
  const porFecha = agrupa(ops, (o) => o.fecha.slice(0, 10));
  const dias = Array.from(porFecha.values());
  if (dias.length >= 8) {
    const prom = m.n / dias.length;
    const lim = Math.max(3, prom * 1.5);
    const muchos = dias.filter((d) => d.n > lim), pocos = dias.filter((d) => d.n <= lim);
    if (muchos.length >= 3 && pocos.length >= 3) {
      const rm = muchos.reduce((a, d) => a + d.neto, 0) / muchos.length, rp = pocos.reduce((a, d) => a + d.neto, 0) / pocos.length;
      if (rm < rp && rm < 0) out.push({ nivel: "alerta", titulo: "Pon un tope de operaciones por día", texto: "En los " + muchos.length + " días en que hiciste más de " + Math.floor(lim) + " operaciones, tu resultado promedio fue " + f.mp(rm) + " por día, contra " + f.mp(rp) + " en tus días normales. Sobreoperar te cuesta: define un máximo diario (por ejemplo " + Math.max(2, Math.round(prom)) + ") y respétalo." });
    }
  }

  // 6) Rachas
  if (m.rachaP >= 5) out.push({ nivel: "consejo", titulo: "Regla de pausa tras pérdidas seguidas", texto: "Tu peor racha fue de " + m.rachaP + " pérdidas seguidas. Define una regla: tras 3 pérdidas consecutivas, cierras la plataforma por el día. Evita buscar recuperar de golpe." });

  // 7) Gestión de riesgo
  if (m.n >= 10) {
    if (capital > 0) {
      const peorPct = (Math.abs(m.peor) / capital) * 100;
      if (m.peor < 0 && peorPct >= 5) out.push({ nivel: "alerta", titulo: "Tu mayor pérdida es demasiado grande para tu capital", texto: "Tu peor operación perdió " + f.mp(m.peor) + ", es decir " + peorPct.toLocaleString("es-PY", { maximumFractionDigits: 1 }) + "% de tu capital inicial. Una referencia habitual es arriesgar entre 1% y 2% del capital por operación (" + (capital * 0.01).toLocaleString("es-PY", { maximumFractionDigits: 0 }) + " a " + (capital * 0.02).toLocaleString("es-PY", { maximumFractionDigits: 0 }) + " dólares en tu caso). Usa siempre stop loss y calcula el lote en función de él." });
      else if (m.promPerdida < 0 && (Math.abs(m.promPerdida) / capital) * 100 > 2) out.push({ nivel: "consejo", titulo: "Tu pérdida promedio supera el 2% del capital", texto: "Pierdes en promedio " + f.mp(m.promPerdida) + " cuando una operación sale mal. Reducir el lote para quedar cerca del 1% o 2% por operación te da mucho más margen de error." });
      const ddPct = (m.ddMax / (capital + m.ddPico)) * 100;
      if (ddPct >= 20) out.push({ nivel: "alerta", titulo: "Tu drawdown fue muy profundo", texto: "Llegaste a caer " + ddPct.toLocaleString("es-PY", { maximumFractionDigits: 1 }) + "% desde tu pico de capital (" + f.mp(-m.ddMax) + "). Un drawdown así es difícil de recuperar. Baja el riesgo por operación y define un límite de pérdida diaria y semanal." });
      else if (ddPct >= 10) out.push({ nivel: "consejo", titulo: "Vigila tu drawdown", texto: "Tu caída máxima fue " + ddPct.toLocaleString("es-PY", { maximumFractionDigits: 1 }) + "% desde el pico. Define un límite de pérdida (por ejemplo 3% diario) para frenar antes de que crezca." });
    } else {
      out.push({ nivel: "consejo", titulo: "Define tu capital inicial para evaluar tu gestión de riesgo", texto: "Con tu capital inicial puedo decirte qué porcentaje arriesgas por operación y qué tan profundo fue tu drawdown. Cárgalo arriba." });
    }
    if (m.promPerdida < 0 && m.peor < 3 * m.promPerdida) out.push({ nivel: "alerta", titulo: "Hay pérdidas que se te salen de control", texto: "Tu peor operación (" + f.mp(m.peor) + ") es más de 3 veces tu pérdida promedio (" + f.mp(m.promPerdida) + "). Suele deberse a no usar stop loss, moverlo o promediar en contra. Fíjalo antes de entrar y no lo muevas." });
  }

  // 8) Expectativa: aciertos vs relación ganancia/pérdida
  if (m.n >= 20) {
    if (m.esperanza < 0) {
      if (m.payoff != null && m.payoff < 1 && m.tasa < 0.6) out.push({ nivel: "alerta", titulo: "Tu ganancia promedio es menor que tu pérdida promedio", texto: "Aciertas " + pct(m.tasa) + " de las veces, pero cada pérdida (" + f.mp(m.promPerdida) + ") pesa más que cada ganancia (" + f.mp(m.promGanada) + "). Prueba buscar objetivos más amplios o cerrar antes las perdedoras: el ratio ganancia/pérdida debería acercarse a 1,5 o más con tu tasa de aciertos." });
      else if (m.tasa < 0.4) out.push({ nivel: "alerta", titulo: "Tu tasa de aciertos es baja", texto: "Aciertas " + pct(m.tasa) + " de las operaciones. Con esa tasa necesitas que tus ganadoras sean mucho mayores que tus perdedoras; si no, filtra más tus entradas y opera solo tu mejor setup." });
    } else if (m.pf != null && m.pf >= 1.3) out.push({ nivel: "ok", titulo: "Vas con expectativa positiva", texto: "Tu profit factor es " + m.pf.toLocaleString("es-PY", { maximumFractionDigits: 2 }) + " y ganas " + f.mp(m.esperanza) + " por operación en promedio. Lo más importante ahora es mantener el riesgo constante." });
  }

  // 9) Disciplina y emociones
  const porPlan = agrupa(ops, (o) => (o.plan === true ? "si" : o.plan === false ? "no" : null));
  const si = porPlan.get("si"), no = porPlan.get("no");
  if (si && no && si.n >= 3 && no.n >= 3 && no.neto / no.n < si.neto / si.n) out.push({ nivel: "alerta", titulo: "Seguir tu plan te rinde más", texto: "Cuando sigues tu plan ganas " + f.mp(si.neto / si.n) + " por operación; cuando no, " + f.mp(no.neto / no.n) + ". Antes de entrar, pregúntate: ¿esto está en mi plan?" });
  const emoMala = peores(agrupa(ops, (o) => o.emocion || null))[0];
  if (emoMala) out.push({ nivel: "consejo", titulo: "No operes cuando sientas: " + emoMala.k, texto: "Con ese estado de ánimo llevas " + emoMala.n + " operaciones y " + f.mp(emoMala.neto) + ". Si lo notas antes de entrar, mejor espera." });

  const orden = { alerta: 0, consejo: 1, ok: 2 } as const;
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]).slice(0, 9);
}
