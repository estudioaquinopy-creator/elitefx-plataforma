"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { aviso, fallo } from "@/lib/subida";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}
const ruta = (id: string) => "/cursos/" + id + "/examen";

export async function enviarExamen(f: FormData) {
  await perfilActual();
  const curso = String(f.get("curso_id") ?? "");
  const resp: Record<string, number> = {};
  for (const [k, v] of f.entries()) {
    if (k.startsWith("p_")) { const n = Number(v); if (Number.isInteger(n) && n >= 0) resp[k.slice(2)] = n; }
  }
  const { data, error } = await createClient().rpc("calificar_examen", { p_curso: curso, p_resp: resp });
  if (error) fallo(ruta(curso), "No se pudo calificar: " + error.message);
  const r = (Array.isArray(data) ? data[0] : data) as { aciertos: number; total: number; minimo: number; aprobado: boolean };
  revalidatePath("/cursos"); revalidatePath("/inicio"); revalidatePath("/cursos/" + curso);
  redirect(ruta(curso) + "?a=" + r.aciertos + "&t=" + r.total + "&m=" + r.minimo + "&ok=" + (r.aprobado ? "1" : "0"));
}

export async function guardarConfig(f: FormData) {
  await soloAdmin();
  const curso = String(f.get("curso_id") ?? "");
  const preguntas = Math.max(1, Math.min(100, Math.round(Number(f.get("preguntas")) || 10)));
  const minimo = Math.max(1, Math.min(preguntas, Math.round(Number(f.get("minimo")) || 7)));
  const { error } = await createClient().from("examen_config").upsert({ curso_id: curso, activo: f.get("activo") === "on", preguntas, minimo });
  if (error) fallo(ruta(curso), "No se pudo guardar: " + error.message);
  revalidatePath("/cursos"); revalidatePath("/inicio"); revalidatePath("/cursos/" + curso);
  aviso(ruta(curso), "Configuración guardada.");
}

export async function agregarPregunta(f: FormData) {
  await soloAdmin();
  const curso = String(f.get("curso_id") ?? "");
  const texto = String(f.get("texto") ?? "").trim();
  const ops = [1, 2, 3, 4].map((i) => String(f.get("o" + i) ?? "").trim());
  const idx = Number(f.get("correcta"));
  if (!texto) fallo(ruta(curso), "Escribe la pregunta.");
  const opciones = ops.filter(Boolean);
  if (opciones.length < 2) fallo(ruta(curso), "Escribe al menos dos opciones.");
  if (!ops[idx]) fallo(ruta(curso), "La opción correcta no puede estar vacía.");
  const correcta = ops.slice(0, idx).filter(Boolean).length;
  const { error } = await createClient().from("examen_banco").insert({ curso_id: curso, texto, opciones, correcta });
  if (error) fallo(ruta(curso), "No se pudo agregar: " + error.message);
  revalidatePath(ruta(curso));
  aviso(ruta(curso), "Pregunta agregada.");
}

type P = { texto: string; opciones: string[]; correcta: number };
function parsear(txt: string): P[] {
  const out: P[] = [];
  const bloques = txt.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  bloques.forEach((b, n) => {
    const ls = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const texto = ls[0].replace(/^\d+\s*[.)\-]\s*/, "").trim();
    const opciones: string[] = [];
    let correcta = -1;
    for (const l of ls.slice(1)) {
      let t = l, marcada = false;
      if (t.startsWith("*")) { marcada = true; t = t.slice(1).trim(); }
      t = t.replace(/^[a-fA-F]\s*[.)]\s+/, "").replace(/^[-•]\s+/, "");
      if (t.startsWith("*")) { marcada = true; t = t.slice(1).trim(); }
      if (t.endsWith("*")) { marcada = true; t = t.slice(0, -1).trim(); }
      if (!t) continue;
      if (marcada) correcta = opciones.length;
      opciones.push(t);
    }
    if (!texto || opciones.length < 2 || opciones.length > 6 || correcta < 0)
      throw new Error("Pregunta " + (n + 1) + ": necesita el enunciado, de 2 a 6 opciones y una marcada con * como correcta.");
    out.push({ texto, opciones, correcta });
  });
  return out;
}

export async function importarPreguntas(f: FormData) {
  await soloAdmin();
  const curso = String(f.get("curso_id") ?? "");
  let lista: P[] = [];
  try { lista = parsear(String(f.get("texto") ?? "")); } catch (e) { fallo(ruta(curso), (e as Error).message); }
  if (!lista.length) fallo(ruta(curso), "No encontré preguntas en el texto.");
  const { error } = await createClient().from("examen_banco").insert(lista.map((p) => ({ curso_id: curso, ...p })));
  if (error) fallo(ruta(curso), "No se pudieron guardar: " + error.message);
  revalidatePath(ruta(curso));
  aviso(ruta(curso), lista.length + " pregunta(s) agregadas.");
}

export async function borrarPregunta(f: FormData) {
  await soloAdmin();
  const curso = String(f.get("curso_id") ?? "");
  await createClient().from("examen_banco").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath(ruta(curso));
  redirect(ruta(curso));
}
