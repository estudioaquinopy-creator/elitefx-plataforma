import { Fragment } from "react";

// Resalta las @menciones (@Nombre Apellido) dentro de un texto. Solo es visual: los avisos los genera la base de datos.
const RE = /(@\p{Lu}[\p{L}'.-]*(?:(?: (?:d[aeo]s?|del|la|los|las|van|von|di))? \p{Lu}[\p{L}'.-]*){0,2})/gu;

export default function TextoMenciones({ texto }: { texto: string }) {
  const partes = texto.split(RE);
  return (
    <>
      {partes.map((t, i) => (i % 2 === 1 ? <b key={i} className="mencion">{t}</b> : <Fragment key={i}>{t}</Fragment>))}
    </>
  );
}
