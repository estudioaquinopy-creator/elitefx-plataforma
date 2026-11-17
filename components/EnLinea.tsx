"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pres = { n: string };

// Personas conectadas ahora mismo (presencia en tiempo real). Cada pestaña abierta de la plataforma cuenta como conectada.
export default function EnLinea({ id, nombre }: { id: string; nombre: string }) {
  const [lista, setLista] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const sb = createClient();
    // "Nombre A." para no mostrar el nombre completo ni el correo.
    const partes = nombre.split(/\s+/).filter(Boolean);
    const corto = nombre.includes("@") ? partes[0].split("@")[0] : partes.length > 1 ? partes[0] + " " + partes[1][0].toUpperCase() + "." : partes[0] || "Alumno";
    const canal = sb.channel("en-linea", { config: { presence: { key: id } } });
    canal.on("presence", { event: "sync" }, () => {
      const estado = canal.presenceState<Pres>();
      const nombres = Object.values(estado).map((v) => v[0]?.n || "Alumno");
      setLista(nombres.sort((a, b) => a.localeCompare(b, "es")));
    });
    canal.subscribe(async (s) => { if (s === "SUBSCRIBED") await canal.track({ n: corto }); });
    return () => { sb.removeChannel(canal); };
  }, [id, nombre]);

  if (lista.length === 0) return null;
  return (
    <div className="enlinea">
      <button className="pill ok" onClick={() => setAbierto(!abierto)} aria-label="Personas en línea">
        <span className="punto" /> {lista.length} en línea
      </button>
      {abierto && <div className="cierra" onClick={() => setAbierto(false)} />}
      {abierto && (
        <div className="drop el">
          <div className="drop-h"><b>En línea ahora</b></div>
          <div className="el-l">
            {lista.slice(0, 60).map((n, i) => <div key={i}><span className="punto" /> {n}</div>)}
            {lista.length > 60 && <p className="mu">… y {lista.length - 60} más</p>}
          </div>
        </div>
      )}
    </div>
  );
}
