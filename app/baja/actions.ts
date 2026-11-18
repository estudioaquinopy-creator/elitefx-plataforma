"use server";
import { redirect } from "next/navigation";
import { clienteAdmin } from "@/lib/supabase/admin";
import { tokenBaja } from "@/lib/correos";

export async function darDeBaja(f: FormData) {
  const email = String(f.get("e") ?? "").trim().toLowerCase();
  const t = String(f.get("t") ?? "");
  if (!email || t !== tokenBaja(email)) redirect("/baja");
  const db = clienteAdmin();
  if (db) await db.from("correos_bajas").upsert({ email });
  redirect("/baja?ok=1");
}
