"use server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual } from "@/lib/sesion";

export type FilaImp = { nombre: string; email: string; telefono: string; plan: string; vence: string };
export type ResImp = { email: string; estado: "creado" | "actualizado" | "existe" | "error"; detalle?: string };

const PLANES = ["gratis", "live_trading", "scanner"];

// Procesa un lote (hasta 50 filas) de la importación. Las cuentas se crean ya confirmadas, con una contraseña aleatoria
// que nadie conoce: cada alumno entra con "Olvidé mi contraseña" (no se envía ningún correo desde aquí).
export async function importarLote(filas: FilaImp[], actualizar: boolean): Promise<ResImp[]> {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const admin = clienteAdmin();
  if (!admin) return filas.map((f) => ({ email: f.email, estado: "error" as const, detalle: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel." }));
  if (filas.length > 50) throw new Error("Lote demasiado grande.");

  async function una(f: FilaImp): Promise<ResImp> {
    const email = String(f.email || "").trim().toLowerCase();
    const nombre = String(f.nombre || "").trim();
    const telefono = String(f.telefono || "").trim();
    const plan = PLANES.includes(f.plan) ? f.plan : "gratis";
    const vence = plan !== "gratis" && /^\d{4}-\d{2}-\d{2}$/.test(f.vence || "") ? f.vence : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return { email, estado: "error", detalle: "Correo no válido" };
    try {
      const pass = crypto.randomUUID() + "Aa1!";
      const { data, error } = await admin!.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { nombre, telefono } });
      if (error || !data.user) {
        const m = (error?.message ?? "").toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
          const { data: p } = await admin!.from("perfiles").select("id").eq("email", email).maybeSingle();
          if (!actualizar || !p) return { email, estado: "existe", detalle: "Ya tenía cuenta" };
          const cambios: Record<string, unknown> = { plan, vence };
          if (nombre) cambios.nombre = nombre;
          if (telefono) cambios.telefono = telefono;
          const { error: e3 } = await admin!.from("perfiles").update(cambios).eq("id", p.id);
          return e3 ? { email, estado: "error", detalle: e3.message } : { email, estado: "actualizado" };
        }
        return { email, estado: "error", detalle: error?.message ?? "No se pudo crear" };
      }
      const { error: e2 } = await admin!.from("perfiles").update({ nombre, telefono: telefono || null, plan, vence }).eq("id", data.user.id);
      if (e2) return { email, estado: "error", detalle: "Cuenta creada, pero no se guardó el plan: " + e2.message };
      return { email, estado: "creado" };
    } catch (e) {
      return { email, estado: "error", detalle: (e as Error).message };
    }
  }

  // 5 en paralelo para ir rápido sin saturar.
  const out: ResImp[] = [];
  for (let i = 0; i < filas.length; i += 5) out.push(...(await Promise.all(filas.slice(i, i + 5).map(una))));
  return out;
}
