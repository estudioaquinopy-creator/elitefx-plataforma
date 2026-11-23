"use client";
import { useRouter } from "next/navigation";
import { registrarAvisoWhatsApp } from "@/app/(app)/accesos/actions";

// Abre WhatsApp con el mensaje y, al mismo tiempo, deja registrado que el administrador avisó a esta persona.
export default function AvisarWhatsApp({ id, href, texto = "Avisar por WhatsApp", className = "btn g s" }: { id: string; href: string; texto?: string; className?: string }) {
  const router = useRouter();
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        registrarAvisoWhatsApp(id).then(() => router.refresh()).catch(() => { /* el aviso se abre igual */ });
      }}
    >
      {texto}
    </a>
  );
}
