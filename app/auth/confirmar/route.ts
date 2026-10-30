import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TIPOS = ["invite", "recovery", "signup", "magiclink", "email", "email_change"];

// Destino de los enlaces de los correos (invitación y recuperar contraseña).
// El GET NO canjea el código: solo lleva a una página con un botón. Así los escáneres de correo
// y antivirus que abren el enlace no lo gastan. El código se canjea al pulsar el botón (POST).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const destino = new URL("/auth/continuar", origin);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (token_hash) destino.searchParams.set("token_hash", token_hash);
  if (type) destino.searchParams.set("type", type);
  return NextResponse.redirect(destino);
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const token_hash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");
  const destino = new URL("/nueva-clave", origin);
  if (token_hash && TIPOS.includes(type)) {
    const { error } = await createClient().auth.verifyOtp({ type: type as EmailOtpType, token_hash });
    if (error) destino.searchParams.set("error", "1");
  } else {
    destino.searchParams.set("error", "1");
  }
  return NextResponse.redirect(destino, 303);
}
