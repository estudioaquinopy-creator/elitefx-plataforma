# ELITE FX · Plataforma

Next.js 14 + Supabase + Vercel. Etapa 1: inicio de sesión, perfiles, roles y membresías.

## Puesta en marcha
1. Supabase > SQL Editor: ejecutar `supabase/migrations/0001_base.sql`.
2. Supabase > Authentication > Users > Add user: crear tu usuario; luego en SQL Editor:
   `update public.perfiles set rol = 'admin' where email = 'TU-CORREO';`
3. Copiar `.env.example` a `.env.local` y completar las dos variables (Supabase > Project Settings > API).
4. `npm install && npm run dev`.
5. En Vercel: importar este repositorio y pegar las mismas dos variables.
