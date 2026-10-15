import Shell from "@/components/Shell";
import { perfilActual, esMiembro } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  const miembro = esMiembro(perfil);
  const items = [
    { href: "/inicio", label: "Inicio", lock: false },
    { href: "/cursos", label: "Cursos", lock: false },
    { href: "/calendario", label: "Calendario", lock: !miembro },
    { href: "/tutoriales", label: "Tutoriales", lock: !miembro },
    { href: "/aliados", label: "Aliados", lock: false },
    { href: "/comunidad", label: "Comunidad", lock: false },
    { href: "/journal", label: "Journal", lock: false },
  ];
  return (
    <Shell items={items} nombre={perfil.nombre || perfil.email}>
      {children}
    </Shell>
  );
}
