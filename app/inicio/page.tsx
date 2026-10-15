import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol, plan, vence")
    .eq("id", user.id)
    .single();

  return (
    <main className="center">
      <section className="card">
        <div className="logo">ELITE <span>FX</span></div>
        <h1>Hola, {perfil?.nombre ?? user.email}</h1>
        <p className="sub">Rol: {perfil?.rol ?? "—"} · Plan: {perfil?.plan ?? "—"}</p>
        <form action="/auth/salir" method="post">
          <button className="btn">Cerrar sesión</button>
        </form>
      </section>
    </main>
  );
}
