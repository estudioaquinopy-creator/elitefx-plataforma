# ELITE FX · Plataforma de estudio

Plataforma propia de la academia ELITE FX (+900 alumnos, migrando desde Skool). Todo el texto de la interfaz, los mensajes y los commits explicativos van **en español**. Dueño: Marcos Aquino.

## Stack y despliegue
- Next.js 14 (App Router, server components y server actions) + Supabase (Postgres con RLS, Auth, Storage) + Vercel.
- Cada push a `main` se despliega solo en Vercel. No hay entorno de pruebas: **cuida lo que subes a `main`**.
- No se puede compilar en el entorno de Claude (npm bloqueado) y `ignoreBuildErrors` está activo: los errores solo se ven en Vercel. Revisa dos veces el código (sobre todo el alcance de variables y los imports).
- Dominio de producción: `academia.elitefx.com.py` (también existe `elitefx-plataforma.vercel.app`).

## Variables de entorno (en Vercel, nunca en el repositorio ni en el chat)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor: crear/invitar personas, cambiar roles; ver `lib/supabase/admin.ts`). Nunca con prefijo `NEXT_PUBLIC_`.
- Cambiar una variable exige un redeploy.

## Base de datos
- Migraciones en `supabase/migrations/` (0001…0024). **Se ejecutan a mano** en Supabase → SQL Editor, en orden. Si agregas una, créala idempotente (`if not exists`, `drop policy if exists`) y avisa al dueño que la corra antes de usar la función nueva.
- Seguridad por RLS: helpers `es_admin()`, `es_miembro()`, `tiene_acceso(sec)`. Los alumnos solo pueden editar `nombre`, `telefono`, `avatar_url`, `notif_leidas_at` de su perfil.
- Examen: las respuestas correctas nunca salen de la base (`examen_preguntas` y `calificar_examen` son funciones `security definer`).

## Correos
- Los correos de la cuenta (registro, invitación, recuperar contraseña) los envía Supabase Auth por SMTP de Resend, desde `@elitefx.com.py`. Se configuran en el panel de Supabase, no en el código.
- Plantillas en español en `supabase/correos/` (se pegan a mano en Authentication → Emails → Templates); guía completa en `supabase/correos/LEEME.md`. Si cambias una plantilla, avisa al dueño que la vuelva a pegar.
- Plan gratis de Resend: 100 correos por día. Tenerlo en cuenta para invitaciones masivas.

## Reglas de negocio
- Niveles: admin / miembro gratuito / miembro VIP. Solo hay dos planes: `gratis` y VIP (guardado como `live_trading`; `scanner` es un valor antiguo y se trata igual que VIP; la migración 0020 lo unifica). El admin elige 1, 2 o 3 meses de calendario VIP. Los miembros tienen acceso de por vida a los cursos; el calendario solo mientras `vence` esté vigente.
- Gratis: solo cursos marcados "visible para el plan gratuito" (todos menos Curso intermedio, Curso avanzado y Data de nivel 2), la sección Tutoriales y el Broker recomendado (ruta `/aliados`). Calendario, Comunidad, Journal y Noticias son solo para miembros (el admin puede dar accesos puntuales por persona).
- Los anuncios los publica solo el admin. El Journal es privado de cada persona;  El capital inicial de cada persona (tabla `journal_config`, migración 0018) es la base de todos los porcentajes del Journal; se puede importar el reporte de MetaTrader 5 (HTML/XLSX/CSV) en `components/ImportarMT5.tsx` con el lector `lib/mt5.ts` (se lee en el navegador; usa `fflate` para XLSX) y las métricas están en `lib/metricas.ts` y las recomendaciones personalizadas (reglas fijas por horario, par, día, riesgo, disciplina) en `lib/consejos.ts`. Las operaciones importadas llevan `origen = 'mt5'` y `ticket` único por persona.
- Examen: solo entre cursos de la ruta. Solo Curso básico, intermedio y avanzado tienen examen; Primeros pasos, Data de nivel 2, Scanner Elite y Tutoriales NO (no aparece la sección ni a alumnos ni a admin; ver `cursoSinExamen` en `lib/examen.ts`); básico → intermedio, intermedio → avanzado y avanzado → Data de nivel 2 sí (10 preguntas al azar del banco, 7 correctas; el curso siguiente queda bloqueado hasta aprobar). Los admins no tienen bloqueos.
- Ranking de la comunidad (`/comunidad/ranking`, migración 0022): mensual, **cierra el último viernes del mes a las 23:59 (Paraguay)**: lo publicado desde el sábado cuenta para el mes siguiente (migración 0024, `ranking_cierre()`; `lib/ranking.ts`; contador en `components/CuentaRanking.tsx`), solo miembros VIP (el admin no participa); puntos por calidad (resultado 3 +1 con imagen, pregunta 2, respuesta ≥20 caracteres 1, respuesta marcada útil 5, me gusta recibido 1 con máx. 10 por publicación; tope 12 puntos al día sin contar útiles; límites anti-abuso de la migración 0023: máx. 2 preguntas y 2 resultados puntuables por día, solo la primera respuesta de cada persona por publicación (máx. 5 al día), una respuesta útil por publicación y persona). Se calcula en vivo con `ranking_mes()`; premios en USDT por puesto (por defecto 200, 100 y 50; editables, clave `ranking_premios`); el admin puede ajustar puntos con motivo (`ranking_ajustes`).
- Noticias: solo alto impacto (fijo); cada persona elige sus monedas (cookie `noticias_monedas`; por defecto USD, EUR, GBP, CAD) y cada noticia muestra una cuenta regresiva cuando falta 1 hora o menos, y Inicio avisa con un contador (`components/AvisoNoticias.tsx`, `lib/noticias.ts`) cuando falta 1 hora para una noticia de sus monedas.
- Zona horaria: Paraguay (`America/Asuncion`, UTC-3). Las sesiones fijas (Londres 6:00, Nueva York 10:00, Asia 21:00) se calculan en `lib/horario.ts`.
- Las sesiones en vivo son por Google Meet; cada sesión tiene su propio enlace (no existe enlace general).
- Videos: Vimeo (privado, restringido a dominios, sin descarga) y YouTube; `lib/video.ts` acepta el enlace o el código de "Incrustar".
- Bienvenida: quien aún no marcó como visto el video "Bienvenido…" de Primeros pasos es llevado a él al entrar a `/inicio` (`lib/bienvenida.ts`); se busca por nombre del curso y título de la lección.
- Modo alumno: el admin ve la plataforma como alumno miembro/gratis (cookie `ver_como`, ver `lib/sesion.ts`).
- Diseño: tema oscuro verde por defecto (+ modo claro). Mantener el menú lateral en tono neutro. No agregar marcas de agua.

## Seguridad
- Todas las acciones de administración comprueban el rol en el servidor (`soloAdmin()`); no confiar nunca en ocultar botones. Las rutas de retorno de formularios pasan por `rutaSegura()` y las imágenes subidas solo aceptan JPG/PNG/WEBP/GIF (`lib/seguridad.ts`).
- Las acciones del admin (membresías, roles, contraseñas, invitaciones, eliminar, importar CSV) se registran con `registrar()` (`lib/auditoria.ts`, tabla `auditoria`, migración 0021); se ve en Accesos → Registro de acciones.
- Sesión: se cierra tras 30 minutos sin actividad (cookie `ult` en `middleware.ts` + aviso y cierre en el navegador con `components/InactividadAuto.tsx`; el latido es `/api/actividad`).
- Examen: exige acceso al curso y 10 minutos de espera entre intentos fallidos (los admins no esperan). Cabeceras de seguridad en `next.config.mjs`.

## Estructura
- `app/(app)/…` secciones con sesión; `app/login`, `registro`, `recuperar`, `nueva-clave` son públicas (ver `middleware.ts`).
- `components/` componentes de cliente; `lib/` utilidades (`sesion.ts` permisos y perfil, `examen.ts` bloqueos, `supabase/` clientes).
- Estilos globales en `app/globals.css` (variables CSS; los bloques se agregan al final y sobrescriben a los anteriores).

## Pendientes conocidos
Recordatorios por correo/WhatsApp, cobros con Pagopar, certificados, foto de perfil en la comunidad, términos y condiciones, igualar la región de Vercel con la de Supabase.

## Al subir cambios
Mensajes de commit en español, terminados con:
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
`Claude-Session: <enlace de la sesión>`
