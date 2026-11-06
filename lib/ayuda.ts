import { clienteAdmin } from "@/lib/supabase/admin";

// Etiqueta de ayuda: #ayuda o @ayuda en el título o el mensaje de una pregunta.
const RE = /(^|[\s(])[#@]ayuda(?![\p{L}\p{N}_])/iu;
export const tieneAyuda = (...textos: (string | null | undefined)[]) => textos.some((t) => !!t && RE.test(t));

// Correo opcional a los administradores. Solo se envía si existe RESEND_API_KEY en Vercel (la misma clave que usa Supabase como contraseña SMTP).
// Nunca bloquea ni hace fallar la publicación.
export async function correoAyuda(autor: string, titulo: string, cuerpo: string, origen: string) {
  try {
    const clave = process.env.RESEND_API_KEY;
    const adm = clienteAdmin();
    if (!clave || !adm) return;
    const { data } = await adm.from("perfiles").select("email").eq("rol", "admin");
    const para = ((data ?? []) as { email: string }[]).map((x) => x.email).filter(Boolean);
    if (!para.length) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const texto = (titulo ? titulo + "\n\n" : "") + cuerpo;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + clave, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AVISOS_REMITENTE || "ELITE FX <no-reply@elitefx.com.py>",
        to: para,
        subject: "🆘 " + autor + " pidió ayuda en la comunidad",
        html: "<p><b>" + esc(autor) + "</b> escribió <b>#ayuda</b> en Preguntas generales:</p><blockquote style=\"white-space:pre-wrap\">" + esc(texto.slice(0, 1500)) + "</blockquote><p><a href=\"" + origen + "/comunidad?canal=preguntas\">Abrir la comunidad y responder</a></p>",
      }),
    });
  } catch {
    // sin correo no pasa nada: el aviso en la campana igual llega
  }
}
