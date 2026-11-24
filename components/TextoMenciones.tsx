import { Fragment } from "react";

// Resalta las @menciones (@Nombre Apellido) dentro de un texto. Solo es visual: los avisos los genera la base de datos.
const RE = /(@\p{Lu}[\p{L}'.-]*(?:(?: (?:d[aeo]s?|del|la|los|las|van|von|di))? \p{Lu}[\p{L}'.-]*){0,2})/gu;
// Enlaces (solo http/https o www.): se resaltan SOLO en lo que escriben los administradores; en lo de los miembros siguen siendo texto plano.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

// modo "activo": enlace en el que se puede tocar (dentro de la publicación abierta y en las respuestas).
// modo "resaltar": solo se ve resaltado, sin enlace (en la lista, donde tocar la tarjeta abre la publicación).
export type ModoEnlaces = "activo" | "resaltar";

function ConEnlaces({ texto, modo }: { texto: string; modo?: ModoEnlaces }) {
  if (!modo) return <>{texto}</>;
  return (
    <>
      {texto.split(URL_RE).map((t, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{t}</Fragment>;
        const m = t.match(/[.,;:!?)\]]+$/); // puntuación final que no es parte del enlace
        const cola = m ? m[0] : "";
        const url = cola ? t.slice(0, -cola.length) : t;
        const href = /^https?:\/\//i.test(url) ? url : "https://" + url;
        return (
          <Fragment key={i}>
            {modo === "activo"
              ? <a className="enlace-admin" href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{url}</a>
              : <span className="enlace-admin">{url}</span>}
            {cola}
          </Fragment>
        );
      })}
    </>
  );
}

export default function TextoMenciones({ texto, enlaces }: { texto: string; enlaces?: ModoEnlaces }) {
  const partes = texto.split(RE);
  return (
    <>
      {partes.map((t, i) => (i % 2 === 1 ? <b key={i} className="mencion">{t}</b> : <ConEnlaces key={i} texto={t} modo={enlaces} />))}
    </>
  );
}
