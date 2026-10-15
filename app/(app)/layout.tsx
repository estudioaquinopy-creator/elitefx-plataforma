import Shell from "@/components/Shell";
import { perfilActual, esMiembro } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  const miembro = esMiembro(perfil);
  const items = [
    { href: "/inicio", label: "Inicio", lock: false, icon: "M3 11l9-8 9 8M5 10v10h14V10" },
    { href: "/cursos", label: "Cursos", lock: false, icon: "M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-3a3 3 0 0 0-3 3" },
    { href: "/calendario", label: "Calendario", lock: !miembro, icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13H3zM3 11h18M8 3v4M16 3v4" },
    { href: "/tutoriales", label: "Tutoriales", lock: !miembro, icon: "M3 6h18v12H3zM10 9.5v5l4.5-2.5z" },
    { href: "/aliados", label: "Aliados", lock: false, icon: "M3 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M11 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0" },
    { href: "/comunidad", label: "Comunidad", lock: false, icon: "M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z" },
    { href: "/journal", label: "Journal", lock: false, icon: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM9 4v16M12 9h4M12 13h4" },
  ];
  if (perfil.rol === "admin") {
    items.push({ href: "/accesos", label: "Accesos", lock: false, icon: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" });
  }
  return (
    <Shell items={items} nombre={perfil.nombre || perfil.email}>
      {children}
    </Shell>
  );
}
