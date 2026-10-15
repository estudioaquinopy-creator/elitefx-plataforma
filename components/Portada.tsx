import { guardarPortada } from "@/app/(app)/ajustes-actions";

// Banner de portada de una sección. El administrador puede cambiarlo o quitarlo desde la misma portada.
export default function Portada({ url, clave, ruta, admin, titulo }: { url: string; clave: string; ruta: string; admin: boolean; titulo: string }) {
  return (
    <div className="cov big" style={url ? { backgroundImage: "url(" + url + ")" } : undefined}>
      {!url && <span className="covt">{titulo}</span>}
      {admin && (
        <div className="cvb">
          <form action={guardarPortada} encType="multipart/form-data" className="cvf">
            <input type="hidden" name="clave" value={clave} />
            <input type="hidden" name="ruta" value={ruta} />
            <input type="file" name="portada" accept="image/*" required />
            <button>Subir portada</button>
          </form>
          {url && (
            <form action={guardarPortada}>
              <input type="hidden" name="clave" value={clave} />
              <input type="hidden" name="ruta" value={ruta} />
              <input type="hidden" name="quitar" value="1" />
              <button>Quitar</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
