# Asistente IA de ELITE FX · instalación en esta plataforma

Todo lo del asistente vive aparte; la plataforma existente no se modifica (salvo el enlace "Asistente" del menú).

| Dónde | Qué es |
|---|---|
| `supabase/migrations/0084_ia_asistente.sql` | Esquema propio `ia` (solo agrega; se puede correr más de una vez). |
| `supabase/functions/` | 4 Edge Functions (`ia-soporte`, `ia-panel`, `ia-auditoria-ranking`, `ia-revision-textos`) y sus archivos compartidos. |
| `supabase/ia/` | Esta guía, las tareas programadas, `deshacer_ia.sql`, `env.ejemplo` y las pruebas. |
| `components/efx-ia/` | Chat, panel y estilos (clases `efx-ia-…`, siguen los colores y el tema de la plataforma). |
| `app/(app)/asistente/` | Páginas nuevas: `/asistente` (VIP y administradores) y `/asistente/panel` (solo administradores). |

## Qué lee de la plataforma (solo `select`)

`perfiles`, `publicaciones`, `comentarios`, `likes`, `certificados`, `liquid_cuentas`, `progreso`, y la función `ranking_detalle` (migración 0076).
La plataforma **no guarda los puntos del día en una tabla**: los calcula al vuelo. Por eso el "puntaje registrado" se lee con `ranking_detalle`, la misma función de la pantalla "Revisar" del ranking, y se compara con el cálculo independiente de `reglas.ts`.

## Orden de instalación (lo haces tú; las claves nunca pasan por el chat)

Antes de empezar: tener corridas las migraciones **0076 y 0083** (la auditoría compara contra las reglas simples de la 0083; sin ella marcaría diferencias en el Top 3).

1. **Migración**: pegar `supabase/migrations/0084_ia_asistente.sql` en Supabase → SQL Editor y ejecutar.
2. **Administradores** (SQL Editor). Usa la misma lista de administradores de la plataforma:
   ```sql
   insert into ia.administradores (user_id, nombre)
   select id, coalesce(nullif(btrim(nombre), ''), email) from public.perfiles where rol = 'admin'
   on conflict do nothing;
   ```
   Si más adelante se agrega un administrador nuevo en la plataforma, hay que volver a correr esta consulta.
3. **Secretos** (Supabase → Edge Functions → Secrets, o `supabase secrets set`). La clave de la API la cargas tú directamente:
   - `ANTHROPIC_API_KEY` = tu clave (nunca en el código ni en GitHub)
   - `IA_CRON_TOKEN` = un texto largo y aleatorio (anótalo para el paso 5)
   - `IA_ORIGENES_PERMITIDOS` = `https://academia.elitefx.com.py` (si usas también la dirección de Vercel, sepárala con coma)
   - Opcionales: `IA_MODELO`, `IA_LIMITE_DIARIO_ALUMNO` (por defecto 20 consultas por persona al día)
4. **Desplegar las funciones** desde la carpeta del proyecto (si el CLI pide `supabase/config.toml`, correr antes `supabase init`, que solo crea ese archivo):
   ```bash
   supabase functions deploy ia-auditoria-ranking --no-verify-jwt
   supabase functions deploy ia-revision-textos  --no-verify-jwt
   supabase functions deploy ia-soporte
   supabase functions deploy ia-panel
   ```
5. **Tareas automáticas**: activar `pg_cron` y `pg_net` (Database → Extensions); guardar el token en Vault con `select vault.create_secret('<IA_CRON_TOKEN>', 'ia_cron_token');`; abrir `supabase/ia/tareas_programadas.sql`, cambiar `<PROJECT_REF>` y ejecutarlo.
6. **Publicar la web**: recién cuando lo anterior esté listo, pasar la rama `asistente-ia` a `main` (Vercel despliega solo). Antes de eso, el enlace "Asistente" no existe en producción.
7. **Probar** con el paso 9 del README original (auditoría de un día concreto con `curl`, una semana de observación sin sancionar a nadie con base en la IA, y el chat con una cuenta VIP de prueba).

## Cosas que conviene saber

- **Quién lo usa**: administradores y miembros VIP vigentes (mismo criterio que Comunidad; el candado "Miembros" del menú es el mismo). Los gratuitos no, para controlar el gasto. Lo comprueba la función en el servidor, no solo el menú.
- **Textos de los alumnos y la IA de terceros**: la revisión de textos y el chat envían texto de los miembros a Anthropic. Falta actualizar la política de privacidad (`lib/privacidad.ts`) para informarlo; no se cambió aquí porque implica volver a pedir aceptación.
- **Base de conocimiento**: `supabase/functions/_shared/base_conocimiento.ts`. Lo que dice `[COMPLETAR]` no lo inventa el asistente. Tras editarlo: `supabase functions deploy ia-soporte` (y las otras dos funciones que usan los manuales si cambió el reglamento).
- **Si cambian las reglas del ranking**: actualizar `reglas.ts`, `REGLAMENTO` en `manuales.ts`, agregar un caso en `pruebas/reglas.test.ts` y volver a desplegar. Hoy son: tope 12 al día, mínimo 15 caracteres (título + texto) o imagen, referidos 10/30/10, Liquid 20, certificado 10, foto 5.
- **Pruebas del cálculo** (sin base de datos): `node --experimental-strip-types supabase/ia/pruebas/reglas.test.ts`.
- **Quitar todo**: `supabase/ia/deshacer_ia.sql`, borrar las 4 funciones y quitar la rama o las páginas nuevas.
