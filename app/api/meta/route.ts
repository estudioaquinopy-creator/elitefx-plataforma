import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { PIXEL_ID, EVENTOS_META } from "@/lib/metaPixel";

// API de conversiones de Meta: recibe el evento que el navegador ya envió con fbq
// (mismo event_id, Meta lo deduplica) y lo reenvía desde el servidor con IP, navegador,
// cookies _fbp/_fbc y los datos de la persona cifrados con SHA-256.
// Token en la variable de entorno META_CAPI_TOKEN (Vercel). Sin token no hace nada.
// META_TEST_EVENT_CODE (opcional) manda los eventos a "Probar eventos" de Events Manager.
export const dynamic = "force-dynamic";

const VERSION_API = "v23.0";
const nada = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const limpio = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return nada();

  let cuerpo: any;
  try {
    cuerpo = await req.json();
  } catch {
    return nada();
  }
  const evento = limpio(cuerpo?.evento, 40);
  const id = limpio(cuerpo?.id, 80);
  if (!(EVENTOS_META as readonly string[]).includes(evento) || !id) return nada();

  // Solo se aceptan direcciones de este mismo sitio.
  let url = limpio(cuerpo?.url, 1000);
  try {
    if (new URL(url).host !== req.nextUrl.host) url = req.nextUrl.origin + "/";
  } catch {
    url = req.nextUrl.origin + "/";
  }

  // Datos de la persona: si tiene sesión se toman de su cuenta; si no (registro), de lo que mandó el formulario.
  let email = "";
  let telefono = "";
  let nombre = "";
  let externo = "";
  try {
    const sb = createClient();
    const { data } = await sb.auth.getUser();
    const u = data.user;
    if (u) {
      externo = u.id;
      email = u.email || "";
      telefono = String((u.user_metadata as any)?.telefono || "");
      nombre = String((u.user_metadata as any)?.nombre || "");
    }
  } catch {}
  if (!externo) {
    email = limpio(cuerpo?.persona?.email);
    telefono = limpio(cuerpo?.persona?.telefono, 30);
    nombre = limpio(cuerpo?.persona?.nombre);
  }

  const user_data: Record<string, unknown> = {
    client_ip_address: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined,
    client_user_agent: req.headers.get("user-agent") || undefined,
  };
  const fbp = req.cookies.get("_fbp")?.value;
  if (fbp) user_data.fbp = fbp;
  let fbc = req.cookies.get("_fbc")?.value;
  if (!fbc) {
    try {
      const fbclid = new URL(url).searchParams.get("fbclid");
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch {}
  }
  if (fbc) user_data.fbc = fbc;
  const em = email.toLowerCase().trim();
  if (em.includes("@")) user_data.em = [sha(em)];
  const ph = telefono.replace(/\D/g, "");
  if (ph.length >= 8) user_data.ph = [sha(ph)];
  const partes = nombre.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (partes.length) user_data.fn = [sha(partes[0])];
  if (partes.length > 1) user_data.ln = [sha(partes[partes.length - 1])];
  if (externo) user_data.external_id = [sha(externo)];

  const custom_data: Record<string, string> = {};
  const nombreContenido = limpio(cuerpo?.datos?.content_name, 80);
  if (nombreContenido) custom_data.content_name = nombreContenido;

  const pedido: Record<string, unknown> = {
    data: [
      {
        event_name: evento,
        event_time: Math.floor(Date.now() / 1000),
        event_id: id,
        action_source: "website",
        event_source_url: url,
        user_data,
        ...(Object.keys(custom_data).length ? { custom_data } : {}),
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) pedido.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const r = await fetch(`https://graph.facebook.com/${VERSION_API}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
      cache: "no-store",
    });
    if (!r.ok) console.error("API de conversiones de Meta:", r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error("API de conversiones de Meta: sin respuesta", e);
  }
  return nada();
}
