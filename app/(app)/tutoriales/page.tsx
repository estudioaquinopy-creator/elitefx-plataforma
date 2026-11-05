import { redirect } from "next/navigation";
import { rutaTutoriales } from "@/lib/tutoriales";

export const dynamic = "force-dynamic";

// Los tutoriales ahora viven en Cursos → Tutoriales. Esta ruta solo reenvía (enlaces viejos, p. ej. /tutoriales?v=ID).
export default async function Tutoriales({ searchParams }: { searchParams: { c?: string; v?: string; vista?: string; error?: string } }) {
  const q = new URLSearchParams();
  if (searchParams.c) q.set("c", searchParams.c);
  if (searchParams.v) q.set("v", searchParams.v);
  if (searchParams.vista) q.set("vista", searchParams.vista);
  if (searchParams.error) q.set("error", searchParams.error);
  const s = q.toString();
  redirect((await rutaTutoriales()) + (s ? "?" + s : ""));
}
