import { alternarAnclaje } from "@/app/(app)/accesos/actions";

// Botón para anclar o desanclar el journal de un alumno (solo administradores; la acción vuelve a comprobar el rol).
export default function AnclarJournal({ alumnoId, anclado, volver }: { alumnoId: string; anclado: boolean; volver: string }) {
  return (
    <form action={alternarAnclaje} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={alumnoId} />
      <input type="hidden" name="volver" value={volver} />
      <button className="btn g s">{anclado ? "📌 Desanclar journal" : "📌 Anclar journal"}</button>
    </form>
  );
}
