import { Fragment } from "react";
import { SECCIONES, TERMINOS_FECHA, type Seccion } from "@/lib/terminos";

// Texto con **negrita** simple.
function T({ s }: { s: string }) {
  return <>{s.split("**").map((x, i) => (i % 2 === 1 ? <b key={i}>{x}</b> : <Fragment key={i}>{x}</Fragment>))}</>;
}
function Lista({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return <ul style={{ margin: "6px 0 10px", paddingLeft: 20 }}>{items.map((x, i) => <li key={i} style={{ marginBottom: 6 }}><T s={x} /></li>)}</ul>;
}
function Sec({ s }: { s: Seccion }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>{s.t}</h2>
      {s.p?.map((x, i) => <p key={i} style={{ margin: "0 0 8px" }}><T s={x} /></p>)}
      {s.tabla && (
        <div style={{ margin: "8px 0 10px" }}>
          {s.tabla.map(([a, b]) => <p key={a} style={{ margin: "0 0 6px" }}><b>{a}:</b> {b}</p>)}
        </div>
      )}
      <Lista items={s.items} />
      {s.p2?.map((x, i) => <p key={i} style={{ margin: "0 0 8px" }}><T s={x} /></p>)}
      <Lista items={s.items2} />
    </section>
  );
}

export default function TextoTerminos() {
  return (
    <div className="terminos-txt" style={{ lineHeight: 1.55, fontSize: 14 }}>
      {SECCIONES.map((s) => <Sec key={s.t} s={s} />)}
      <p className="mu">Última actualización: {TERMINOS_FECHA}.</p>
    </div>
  );
}
