# Correos de la cuenta (Resend + Supabase)

Los correos de registro, invitación y recuperación de contraseña los envía **Supabase Auth**. Sin configurar nada salen del servidor de pruebas de Supabase (muy pocos por hora, remitente genérico, suelen caer en spam). Esta guía hace que salgan desde `@elitefx.com.py`, a través de **Resend**, con las plantillas en español de esta carpeta.

No hace falta tocar código ni hacer redeploy: todo se configura en Resend, en el DNS del dominio y en el panel de Supabase.

| Archivo | Plantilla en Supabase | Asunto sugerido |
|---|---|---|
| `invitacion.html` | Invite user | Tu acceso a la plataforma ELITE FX |
| `confirmar.html` | Confirm signup | Confirma tu correo en ELITE FX |
| `recuperar.html` | Reset password | Crea una contraseña nueva · ELITE FX |

## 1. Verificar el dominio en Resend
1. Crear la cuenta en [resend.com](https://resend.com) con el correo de la academia.
2. **Domains → Add domain** → `elitefx.com.py`. Región: **São Paulo (sa-east-1)**, la más cercana.
3. Resend muestra varios registros DNS (DKIM en `resend._domainkey`, y MX + TXT/SPF en el subdominio `send`). Cargarlos tal cual en el panel donde se administra el DNS de `elitefx.com.py`.
   - No borrar ni cambiar los registros MX que ya existan en el dominio principal: los de Resend van en el subdominio `send` y no afectan al correo que ya reciben.
   - Recomendado: agregar también un TXT en `_dmarc` con el valor `v=DMARC1; p=none;` (mejora la llegada a Gmail y Outlook).
4. Volver a Resend y tocar **Verify**. Puede tardar desde minutos hasta unas horas; esperar a que quede en **Verified**.

## 2. Crear la clave de Resend
1. **API Keys → Create API key**. Nombre: `supabase-auth`. Permiso: **Sending access**, limitado al dominio `elitefx.com.py`.
2. Copiarla en ese momento (Resend no la vuelve a mostrar). **No pegarla en el chat ni en el repositorio**: solo va en Supabase.

## 3. Conectar Supabase con Resend (SMTP)
Supabase → **Authentication → Emails → SMTP Settings** → activar *Enable custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `academia@elitefx.com.py` (cualquier dirección del dominio verificado) |
| Sender name | `ELITE FX` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clave del paso 2 |

Guardar.

## 4. Revisar URLs y vencimiento de enlaces
- **Authentication → URL Configuration**
  - *Site URL*: `https://academia.elitefx.com.py`
  - *Redirect URLs*: que estén `https://academia.elitefx.com.py/**` y `https://elitefx-plataforma.vercel.app/**` (la invitación y la recuperación llevan a `/nueva-clave`; si esa ruta no está permitida, el enlace manda al inicio).
- **Vencimiento**: en la configuración del proveedor **Email** (Authentication → Sign In / Providers → Email), subir *Email OTP Expiration* a `86400` segundos (24 h). Así una invitación no vence antes de que el alumno la abra. Las plantillas no mencionan horas para que no queden desactualizadas si se cambia este valor.

## 5. Pegar las plantillas
Supabase → **Authentication → Emails → Templates**. En cada una de las tres (Invite user, Confirm signup, Reset password):
1. Poner el asunto de la tabla de arriba.
2. Borrar el contenido actual y pegar el archivo `.html` completo.
3. Guardar.

Las plantillas usan `{{ .ConfirmationURL }}` (el enlace que arma Supabase) y `{{ .Data.nombre }}` (el nombre cargado al registrarse o al invitar; si no hay nombre, saluda con "Hola:"). El logo se carga desde `https://academia.elitefx.com.py/logo-elitefx.png`.

## 6. Probar
1. En `/recuperar`, pedir un enlace con un correo propio.
2. Desde **Accesos**, invitar a un correo propio (marcar "Enviar invitación por correo").
3. Confirmar que llegan a la bandeja principal, con el remitente `ELITE FX` y el diseño nuevo, y que el botón lleva a "Crea tu contraseña".
4. En Resend → **Emails** debe figurar cada envío como *Delivered*. En Gmail, "Mostrar original" debe decir `SPF: PASS` y `DKIM: PASS`.

## 7. Límites (importante para la migración desde Skool)
- **Plan gratis de Resend: 100 correos por día y 3.000 por mes.** Invitar a los +900 alumnos de una vez no entra en ese plan.
  - Opción A: invitar por tandas de ~90 por día (unos 10 días).
  - Opción B: pasar a Resend Pro (USD 20/mes, 50.000 correos y sin límite diario) durante el mes de la migración y volver al plan gratis después.
- Supabase también tiene su propio tope: **Authentication → Rate Limits → "Rate limit for sending emails"** (por hora). Con SMTP propio se puede subir; ajustarlo según el plan de Resend elegido.
