# Notificaciones de ClínicaMed (Gmail API, SMS Masivos, WhatsApp a futuro)

## Qué hace
| Evento | Aviso |
|---|---|
| Turno registrado | Confirmación (si lo pide el paciente queda "pendiente" y el aviso lo dice) |
| Recepción confirma un turno pendiente | Confirmación |
| Turno reprogramado | Aviso de modificación |
| Turno cancelado | Aviso de cancelación |
| 24 h antes (turnos confirmados) | Recordatorio |
| 2 h antes (turnos confirmados) | Recordatorio |

* **Siempre después de guardar el turno.** Si el turno no se guarda, no se envía nada. Si el envío falla, el turno queda guardado igual.
* **Canal automático:** se usa correo y/o SMS según los datos del paciente (ambos, solo correo, solo teléfono). Sin ningún dato queda registrado como "no enviado" con el motivo.
* **Canal manual:** recepción lo elige al cargar el turno (Automático / Solo correo / Solo SMS / No enviar aviso) y también al reenviar. WhatsApp aparece como "próximamente".
* **Si un canal falla, el otro se envía igual.** Cada envío queda registrado con su estado y error.
* **Sin duplicados:** un mismo aviso (turno + tipo + canal) no se envía dos veces. Solo el botón "Reenviar aviso" lo repite a propósito.
* **Reintentos automáticos** (hasta 3) solo para fallas pasajeras (Gmail caído, red, error 5xx). Credenciales vencidas, saldo insuficiente, respuestas no reconocidas o teléfonos inválidos **no** se reintentan (para no duplicar un SMS que quizá salió).
* **Horario de SMS:** de 08:00 a 22:00 hs (configurable). Fuera de esa franja el SMS queda pendiente y sale en la próxima; el correo sale en el momento.
* **Privacidad:** los avisos llevan solo datos del turno (nunca información clínica). En la base el correo y el teléfono se guardan enmascarados y las claves se eliminan de los mensajes de error.

## Archivos
**Creados:** `services/gmailService.js`, `services/smsService.js`, `services/whatsappService.js` (solo estructura), `services/notificaciones.js` (módulo unificado), `services/notificacionesRepo.js`, `services/plantillas.js`, `services/texto.js`, `db/migracion_notificaciones.sql`, `tests/*.test.js`, `tests/helpers.js`, `tests/run.js`, `docs/NOTIFICACIONES.md`.
**Modificados:** `server.js` (avisos tras guardar, rutas nuevas, tarea programada; se quitó Twilio), `public/index.html` (selector de canal, estado del aviso y "Reenviar aviso" en recepción), `db/schema.sql` (tabla `notificacion`), `package.json`, `.env.example`, `README.md`.
**Eliminados:** `services/twilioService.js` y `db/migracion_recordatorios.sql` (fase anterior con Twilio, reemplazada por esta).

## Base de datos (justificación)
Se agregó una sola tabla, `notificacion`, necesaria para el historial (paciente, turno, canal, fecha, estado, error), evitar duplicados (clave única turno + canal + clave del aviso) y reintentar. No se modificó ninguna tabla existente. La columna `turno.recordatorio_enviado` de la fase de Twilio ya no se usa.

## Dependencias
`googleapis` (Gmail), `node-cron` (tareas programadas). SMS usa el `fetch` de Node 18+. Se quitó `twilio`.

## Variables a completar (`.env`)
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER`, `SMS_MASIVOS_API_KEY`, `SMS_MASIVOS_URL`, `SMS_MASIVOS_TEST`, y opcionales `SMS_HORA_DESDE/HASTA`, `NOTIF_CANAL_PREDETERMINADO`, `NOTIF_CANALES_AUTO`, `NOTIF_RECORDATORIOS`. Para dirección en los avisos: `SEDE_NOMBRE` y `SEDE_DIRECCION`. WhatsApp (`WHATSAPP_*`) quedan reservadas. **No reutilices credenciales que hayan circulado.**

## Cómo probar
* `npm test` — pruebas de los servicios, plantillas y del módulo de notificaciones (no usan internet ni la base).
* `TEST_DB=1 npm test` — suma una prueba contra tu base real (usa las variables `DB_*` del `.env`; limpia lo que crea).
* SMS sin gastar créditos: dejá `SMS_MASIVOS_TEST=1` (envía con `TEST=1`; en la pantalla figura "solo prueba"). Para enviar de verdad, `SMS_MASIVOS_TEST=0`.
* Correo: cargá un turno para un paciente con **tu** correo. Los pacientes de demo (`martin@email.com`, etc.) tienen correos falsos: Gmail rebotaría esos mensajes.
* Recordatorios sin esperar: `POST /api/recordatorios/ejecutar` con sesión de recepción (corre recordatorios y reintentos).
* Historial de un turno: `GET /api/turnos/:id/notificaciones` (recepción).

## Qué fue verificado y cómo
* **Probado de verdad (automático):** normalización de teléfonos, límite de 160 y texto sin tildes, armado del correo (tildes, HTML, inyección de cabeceras), interpretación de respuestas del proveedor, selección de canal, duplicados, reintentos, horario de SMS, ventanas de 24 h y 2 h, y que las claves no se filtren a los registros.
* **Probado contra MariaDB real, con Gmail y SMS simulados:** el recorrido completo (alta, confirmación, reprogramación, cancelación, reenvío, SMS con saldo insuficiente, Gmail caído y reintento, permisos por rol).
* **NO probado con servicios reales:** no hay credenciales de Gmail ni de SMS Masivos en este entorno, así que el envío real de correo y SMS todavía no está comprobado.

## Pendiente / límites conocidos
* **WhatsApp Cloud API:** solo la estructura y las variables. No funciona hasta tener credenciales de Meta.
* **Códigos de error de SMS Masivos:** la documentación recibida solo indica `1` (prueba correcta) y `0` (procesado). Cualquier otra respuesta se trata como error con el texto del proveedor; saldo insuficiente y credenciales se detectan por palabras. Cuando tengas la lista oficial, ajustá `interpretarRespuesta` en `services/smsService.js`.
* **Consulta de saldo:** la documentación recibida no trae un endpoint de saldo, así que no está implementada; el saldo insuficiente se detecta al enviar.
* **Google Calendar:** esta versión del proyecto no tiene esa integración, por lo que no se tocó nada.
* **Reprogramar:** existe la ruta `PATCH /api/turnos/:id/reprogramar` (recepción) y envía el aviso, pero todavía no hay botón en la pantalla.
* **Token de Gmail:** si la app de Google está en modo "Testing", el refresh token vence a los 7 días; para algo estable hay que publicar la app en Google Cloud.
