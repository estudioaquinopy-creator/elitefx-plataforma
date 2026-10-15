import { createClient } from "@/lib/supabase/server";

// Lee todos los ajustes (textos, enlaces y portadas editables) como un objeto clave → valor.
export async function leerAjustes(): Promise<Record<string, string>> {
  const { data } = await createClient().from("ajustes").select("clave, valor");
  const o: Record<string, string> = {};
  for (const a of (data ?? []) as { clave: string; valor: string }[]) o[a.clave] = a.valor;
  return o;
}
