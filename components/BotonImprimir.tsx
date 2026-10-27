"use client";

// Abre el diálogo de impresión del navegador (desde ahí se puede guardar el reporte como PDF).
export default function BotonImprimir() {
  return <button type="button" className="btn g s no-print" style={{ marginBottom: 14 }} onClick={() => window.print()}>Imprimir / guardar PDF</button>;
}
