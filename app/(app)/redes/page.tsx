import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import { guardarTextos } from "../ajustes-actions";
import { GRUPOS, NOMBRES, REDES } from "@/lib/redes";

export const dynamic = "force-dynamic";

export default async function Redes({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") redirect("/inicio");
  const aj = await leerAjustes();
  return (
    <>
      <h1>Redes sociales</h1>
      <p className="sub">Pega el enlace completo de cada red. Las que dejes vacías no se muestran en el menú.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      <form action={guardarTextos} className="fm">
        <input type="hidden" name="ruta" value="/redes" />
        {Object.entries(GRUPOS).map(([g, titulo]) => (
          <section key={g} className="box">
            <h2>{titulo}</h2>
            {REDES.map((n) => (
              <label key={n}>{NOMBRES[n]}
                <input name={"red_" + g + "_" + n} type="url" defaultValue={aj["red_" + g + "_" + n] ?? ""} placeholder="https://…" />
              </label>
            ))}
          </section>
        ))}
        <button className="btn s">Guardar</button>
      </form>
    </>
  );
}
