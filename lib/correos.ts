import { createHmac } from "crypto";
import { hoyPY } from "@/lib/sesion";

// Correos masivos (Resend). Variables de entorno en Vercel: RESEND_API_KEY (obligatoria) y RESEND_FROM (opcional).
export const REMITENTE = process.env.RESEND_FROM || "ELITE FX <academia@elitefx.com.py>";
export const SITIO = "https://academia.elitefx.com.py";
export const TOPE_DIA_DEFECTO = 90; // el plan gratis de Resend permite 100 al día y los correos de la cuenta (invitaciones, recuperar clave) también cuentan

export const AUDIENCIAS: { id: string; etiqueta: string }[] = [
  { id: "gratis_nuevo", etiqueta: "Gratuitos nuevos" },
  { id: "gratis_alumno", etiqueta: "Gratuitos alumno" },
  { id: "vip", etiqueta: "VIP vigentes" },
  { id: "por_vencer", etiqueta: "VIP que vencen en 7 días" },
  { id: "prueba", etiqueta: "En prueba VIP" },
];

type P = { rol?: string | null; plan?: string | null; es_alumno?: boolean | null; prueba_hasta?: string | null; vence?: string | null };

// A qué grupos pertenece una persona (mismas reglas que la plataforma: el VIP vencido cuenta como gratuito alumno).
export function gruposDe(p: P): string[] {
  if (p.rol === "admin") return [];
  const hoy = hoyPY();
  if (p.prueba_hasta && new Date(p.prueba_hasta).getTime() > Date.now()) return ["prueba"];
  const vipVigente = p.plan && p.plan !== "gratis" && !p.prueba_hasta && (!p.vence || p.vence >= hoy);
  if (vipVigente) {
    const lim = new Date(); lim.setDate(lim.getDate() + 7);
    const enSiete = lim.toISOString().slice(0, 10);
    return p.vence && p.vence <= enSiete ? ["vip", "por_vencer"] : ["vip"];
  }
  const alumno = p.es_alumno || (p.plan && p.plan !== "gratis");
  return [alumno ? "gratis_alumno" : "gratis_nuevo"];
}

const clave = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "sin-clave";
export const tokenBaja = (email: string) => createHmac("sha256", clave()).update("baja:" + email.toLowerCase()).digest("hex").slice(0, 32);
export const enlaceBaja = (email: string) => SITIO + "/baja?e=" + encodeURIComponent(email.toLowerCase()) + "&t=" + tokenBaja(email);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Texto plano del administrador → HTML sencillo (saltos de línea y enlaces automáticos).
export function htmlCorreo(nombre: string, mensaje: string, baja: string): string {
  const cuerpo = esc(mensaje).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#00a463">$1</a>').replace(/\n/g, "<br>");
  const saludo = nombre ? "Hola, " + esc(nombre.split(" ")[0]) + "." : "Hola.";
  return '<div style="background:#f4f5f2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">'
    + '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;color:#23262b;font-size:15px;line-height:1.6">'
    + '<p style="margin:0 0 14px"><b>' + saludo + "</b></p>" + "<div>" + cuerpo + "</div>"
    + '<hr style="border:0;border-top:1px solid #e6e8e3;margin:26px 0 14px">'
    + '<p style="margin:0;font-size:12px;color:#7b7d85">ELITE FX · Trading de Alta Precisión<br>Recibes este correo porque eres parte de ELITE FX. <a href="' + baja + '" style="color:#7b7d85">Dejar de recibir estos correos</a>.</p>'
    + "</div></div>";
}

export type Item = { email: string; nombre: string };

// Envía hasta 100 correos en una sola llamada (API "batch" de Resend). Devuelve null si salió bien o el motivo del fallo.
export async function enviarLote(asunto: string, mensaje: string, items: Item[]): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "Falta la variable RESEND_API_KEY en Vercel.";
  const cuerpo = items.map((i) => {
    const baja = enlaceBaja(i.email);
    return { from: REMITENTE, to: [i.email], subject: asunto, html: htmlCorreo(i.nombre, mensaje, baja), headers: { "List-Unsubscribe": "<" + baja + ">" } };
  });
  try {
    const r = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (r.ok) return null;
    const t = await r.text();
    return "Resend respondió " + r.status + ": " + t.slice(0, 200);
  } catch (e) {
    return "No se pudo conectar con Resend: " + (e instanceof Error ? e.message : String(e));
  }
}

// Inicio del día de Resend (medianoche UTC = 21:00 en Paraguay).
export const inicioDiaUTC = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
