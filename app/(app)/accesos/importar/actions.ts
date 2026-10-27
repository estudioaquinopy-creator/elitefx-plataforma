"use server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { perfilActual } from "@/lib/sesion";

export type FilaImp = { nombre: string; email: string; telefono: string; plan: string; vence: string };
export type ResImp = { email: string; estado: "creado" | "invitado" | "reenviado" | "actualizado" | "existe" | "error" | "limite"; detalle?: string };

const PLANES = ["gratis", "live_trading"]; // gratuito o VIP

// Procesa un lote (hasta 50 filas). Con invitar=true cada persona recibe el correo de invitación para crear su contraseña;
// si no, la cuenta se crea con una contraseña aleatoria y la persona entra con "Olvidé mi contraseña". Si se alcanza el
// límite de correos, se detiene y devuelve solo lo procesado.
export async function importarLote(filas: FilaImp[], actualizar: boolean, invitar = false): Promise<ResImp[]> {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const admin = clienteAdmin();
  if (!admin) return filas.map((f) => ({ email: f.email, estado: "error" as const, detalle: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel." }));
  if (filas.length > 50) throw new Error("Lote demasiado grande.");
  const h = headers();
  const origen = h.get("origin") || ("https://" + (h.get("x-forwarded-host") || h.get("host")));
  const esLimite = (m: string) => /rate limit|too many|over_email_send_rate_limit|demasiad/i.test(m);

  async function una(f: FilaImp): Promise<ResImp> {
    const email = String(f.email || "").trim().toLowerCase();
    const nombre = String(f.nombre || "").trim();
    const telefono = String(f.telefono || "").trim();
    const plan = PLANES.includes(f.plan) ? f.plan : "gratis";
    const vence = plan !== "gratis" && /^\d{4}-\d{2}-\d{2}$/.test(f.vence || "") ? f.vence : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return { email, estado: "error", detalle: "Correo no válido" };
    try {
      const pass = crypto.randomUUID() + "Aa1!";
      const { data, error } = invitar
        ? await admin!.auth.admin.inviteUserByEmail(email, { data: { nombre, telefono }, redirectTo: origen + "/nueva-clave" })
        : await admin!.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { nombre, telefono } });
      if (error || !data.user) {
        const m = (error?.message ?? "").toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
          const { data: p } = await admin!.from("perfiles").select("id").eq("email", email).maybeSingle();
          if (!p) return { email, estado: "existe", detalle: "Ya tenía cuenta" };
          if (actualizar) {
            const cambios: Record<string, unknown> = { plan, vence };
            if (nombre) cambios.nombre = nombre;
            if (telefono) cambios.telefono = telefono;
            const { error: e3 } = await admin!.from("perfiles").update(cambios).eq("id", p.id);
            if (e3) return { email, estado: "error", detalle: e3.message };
          }
          // Si pidió invitación y la persona nunca entró, se le vuelve a mandar el correo.
          if (invitar) {
            const { data: u } = await admin!.auth.admin.getUserById(p.id);
            if (u?.user && !u.user.last_sign_in_at) {
              const { error: e4 } = await admin!.auth.resetPasswordForEmail(email, { redirectTo: origen + "/nueva-clave" });
              if (e4) return esLimite(e4.message) ? { email, estado: "limite", detalle: e4.message } : { email, estado: "error", detalle: e4.message };
              return { email, estado: "reenviado" };
            }
          }
          return actualizar ? { email, estado: "actualizado" } : { email, estado: "existe", detalle: "Ya tenía cuenta" };
        }
        if (invitar) {
          // Si el correo no salió, se borra la cuenta a medio crear para poder reintentar limpio.
          const { data: p } = await admin!.from("perfiles").select("id").eq("email", email).maybeSingle();
          if (p) await admin!.auth.admin.deleteUser(p.id);
        }
        const msg = error?.message ?? "No se pudo crear";
        return esLimite(msg) ? { email, estado: "limite", detalle: msg } : { email, estado: "error", detalle: msg };
      }
      const { error: e2 } = await admin!.from("perfiles").update({ nombre, telefono: telefono || null, plan, vence }).eq("id", data.user.id);
      if (e2) return { email, estado: "error", detalle: "Cuenta creada, pero no se guardó el plan: " + e2.message };
      return { email, estado: invitar ? "invitado" : "creado" };
    } catch (e) {
      return { email, estado: "error", detalle: (e as Error).message };
    }
  }

  // Con invitaciones se envía de a uno (los correos tienen límite de ritmo); sin correo, 5 en paralelo.
  const out: ResImp[] = [];
  const paso = invitar ? 1 : 5;
  for (let i = 0; i < filas.length; i += paso) {
    out.push(...(await Promise.all(filas.slice(i, i + paso).map(una))));
    if (out.some((r) => r.estado === "limite")) break;
  }
  return out;
}
