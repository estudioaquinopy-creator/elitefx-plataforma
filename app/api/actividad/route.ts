import { NextResponse } from "next/server";

// Latido de actividad: el middleware renueva el reloj de inactividad en cada solicitud.
export const dynamic = "force-dynamic";
export function GET() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
