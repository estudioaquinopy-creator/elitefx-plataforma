import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión y protege todas las rutas salvo /login y /auth.
// Además cierra la sesión tras 30 minutos sin actividad (cookie "ult" con la hora de la última solicitud).
const INACTIVIDAD_MS = 30 * 60 * 1000;
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const ahora = Date.now();
  const ult = Number(request.cookies.get("ult")?.value ?? 0);
  if (user && ult && ahora - ult > INACTIVIDAD_MS) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?expirada=1";
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    r.cookies.delete("ult");
    return r;
  }
  // Las precargas de enlaces que hace el navegador no cuentan como actividad.
  const precarga = request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (user && !precarga) response.cookies.set("ult", String(ahora), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (!user && request.cookies.get("ult")) response.cookies.delete("ult");
  const publica = pathname.startsWith("/login") || pathname.startsWith("/registro") || pathname.startsWith("/recuperar") || pathname.startsWith("/nueva-clave") || pathname.startsWith("/auth") || pathname.startsWith("/verificar");
  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/registro"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Los archivos públicos (logo, portadas por defecto) no pasan por el control de sesión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)"],
};
