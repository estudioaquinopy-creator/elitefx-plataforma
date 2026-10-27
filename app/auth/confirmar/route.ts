import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de los correos (invitación y recuperar contraseña):
// canjea el código en el servidor, deja la sesión iniciada y lleva a crear la contraseña.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const destino = new URL("/nueva-clave", origin);
  if (token_hash && type) {
    const { error } = await createClient().auth.verifyOtp({ type, token_hash });
    if (error) destino.searchParams.set("error", "1");
  } else {
    destino.searchParams.set("error", "1");
  }
  return NextResponse.redirect(destino);
}
