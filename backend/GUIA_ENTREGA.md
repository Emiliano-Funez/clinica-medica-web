# Entrega del backend de ClinicaMed

Esta carpeta contiene la API de ClinicaMed, sus servicios de correo, SMS y recordatorios, y los archivos SQL para instalar o actualizar la base. Para que la aplicación web completa funcione, el backend debe quedar dentro de la carpeta del proyecto, al mismo nivel que `index.html`, `js`, `pages` y `styles`.

## Estructura esperada

```text
clinicamed/
├── index.html
├── js/
├── pages/
├── styles/
└── backend/
    ├── server.js
    ├── package.json
    ├── .env                 # lo crea el equipo, no se comparte
    ├── .env.example
    ├── db/
    └── services/
```

El servidor sirve el frontend desde la carpeta superior y la configuración actual del frontend llama a `http://localhost:3000/api`.

## Requisitos

- Node.js 18 o posterior.
- MySQL 8 o compatible con InnoDB, claves foráneas y columnas generadas.
- La carpeta del frontend del proyecto junto a `backend`.
- Credenciales propias de MySQL. Gmail, SMS Masivos y Google Maps son opcionales para iniciar la API; se requieren si se quieren usar esos servicios.

## Preparación de la base de datos

### Base nueva

1. Abrir MySQL Workbench o un cliente SQL.
2. Ejecutar `db/schema.sql`. Crea `base_de_datos_clinica`, sus tablas, los roles iniciales y algunas especialidades; no contiene personas reales.
3. Crear un usuario MySQL para la aplicación y darle permisos `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre `base_de_datos_clinica`.

### Base existente del proyecto

1. Hacer una copia de seguridad antes de cambiar el esquema.
2. Seleccionar la base `base_de_datos_clinica` en el cliente SQL.
3. Confirmar que ya existen las tablas base `persona` y `turno`.
4. Ejecutar `db/migracion_notificaciones.sql`. La migración agrega `persona.fecha_nacimiento` si falta y crea `notificacion` si no existe; no elimina registros.
5. Revisar colisiones de horario y ejecutar `db/migracion_turno_paciente_unico.sql`. Si hay turnos activos del mismo paciente en la misma fecha y hora, la migración los informa y espera a que se resuelvan antes de crear la restricción.
6. Crear/configurar el usuario MySQL de aplicación con los permisos indicados.

No ejecutar `schema.sql` como sustituto de una copia de seguridad en una base con datos importantes. No compartir una exportación de la base real: puede contener datos personales y clínicos.

## Variables de entorno

1. Copiar `.env.example` como `.env` dentro de `backend`.
2. Completar como mínimo `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` y `JWT_SECRET`.
3. Para el mapa, completar `GOOGLE_MAPS_API_KEY`, `SEDE_NOMBRE`, `SEDE_DIRECCION`, `SEDE_LAT`, `SEDE_LNG` y, si corresponde, `SEDE_MAP_ID`.
4. Para correo Gmail, completar `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` y `GMAIL_USER` con credenciales OAuth propias.
5. Para SMS, completar `SMS_MASIVOS_API_KEY`. `SMS_MASIVOS_TEST=1` mantiene el modo de prueba; cambiarlo a `0` permite solicitudes de envío reales.

`WHATSAPP_*` está reservado: WhatsApp no está implementado en esta entrega. `.env` contiene secretos y no debe incluirse en Git ni enviarse dentro del ZIP. Cada equipo debe crear su propio archivo a partir de `.env.example`.

## Instalar y ejecutar

En una terminal, desde la carpeta `backend`:

```bash
npm ci
npm start
```

Si todo está configurado, la consola indica que ClinicaMed escucha en `http://localhost:3000`. Abrir esa dirección para cargar la aplicación. Para detener el servidor, usar `Ctrl+C`.

`npm run seed` agrega cuentas de demostración con contraseña `Demo1234`; entre ellas `recepcion@clinicamed.com`, `sofia.lopez@consultorio.com` y `martin@email.com`. Usarlo solo en una base de práctica, nunca en una base con información real. Las personas que antes usaban el modo local del navegador deben registrarse en la base API para que sus cuentas existan allí.

## Funciones de la API

La API usa JSON. Las rutas privadas requieren el encabezado `Authorization: Bearer <token>` devuelto al iniciar sesión.

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| POST | `/api/login` | Público | Iniciar sesión y obtener token |
| POST | `/api/registro` | Público | Crear cuenta de paciente |
| GET | `/api/yo` | Sesión | Consultar usuario de la sesión |
| GET | `/api/catalogos` | Público | Listar especialidades y especialistas |
| GET | `/api/datos` | Sesión | Obtener datos según rol |
| POST | `/api/turnos` | Paciente/recepción | Crear turno |
| PATCH | `/api/turnos/:id` | Paciente/recepción | Cancelar o confirmar turno según permisos |
| PATCH | `/api/turnos/:id/reprogramar` | Recepción | Cambiar fecha u hora |
| POST | `/api/historial` | Especialista | Cargar historial de un turno atendido |
| POST | `/api/pacientes` | Recepción | Registrar paciente |
| PATCH | `/api/pacientes/:id` | Paciente/recepción | Actualizar datos permitidos |
| GET | `/api/sede` | Público | Obtener ubicación y configuración de Maps |
| GET | `/api/turnos/:id/notificaciones` | Recepción | Ver avisos del turno |
| POST | `/api/turnos/:id/notificar` | Recepción | Reenviar aviso |
| POST | `/api/recordatorios/ejecutar` | Recepción | Ejecutar recordatorios y reintentos manualmente |

Los avisos de confirmación se intentan después de guardar el turno. Si un proveedor de correo o SMS falla, el turno queda registrado y el resultado se almacena en `notificacion`. Los recordatorios automáticos se ejecutan cada 15 minutos mientras `NOTIF_RECORDATORIOS=1` y exista al menos un canal configurado.

## Tablas principales

- `persona`, `rol`, `persona_rol`: cuentas y roles.
- `especialidad`, `persona_especialidad`: catálogo de especialidades y profesionales.
- `turno`: turnos, estado y disponibilidad horaria.
- `historial_clinico`: registro asociado a un turno.
- `notificacion`: estado, canal, intentos y errores resumidos de los avisos.

Los roles almacenados son `PACIENTE`, `ESPECIALISTA` y `ADMINISTRATIVO`; la aplicación presenta `ADMINISTRATIVO` como recepción. Las contraseñas nuevas se guardan con bcrypt. El backend también acepta hashes PBKDF2 antiguos y los renueva tras un inicio de sesión correcto.

## Solución de problemas

- **`Access denied for user`**: revisar usuario/contraseña en `.env`, permisos SQL y reiniciar `npm start` después del cambio.
- **`Table ... not found`**: confirmar la base seleccionada en `DB_NAME` y ejecutar el esquema inicial o la migración adecuada.
- **No conecta al servidor MySQL**: revisar que MySQL esté iniciado y `DB_HOST`/`DB_PORT` sean correctos.
- **El frontend no carga al abrir `localhost:3000`**: confirmar que `backend` esté dentro de la carpeta del proyecto y que `index.html`, `js`, `pages` y `styles` estén a su nivel superior.
- **No llega correo**: revisar que el paciente tenga el correo correcto en `persona.email`, que las cuatro variables Gmail estén completas y el estado del aviso en la tabla `notificacion`.
- **No se ve el mapa**: revisar la clave de Maps, que la API requerida esté habilitada en Google Cloud, sus restricciones por dominio y las variables de sede.
- **Prueba desde otra computadora**: `localhost` apunta a esa misma computadora. Hay que desplegar API/base de datos accesibles en red y cambiar `js/config.js` a la URL real de la API; no alcanza con copiar el `.env` de este equipo.

## Alcance y credenciales

El ZIP incluye código, SQL, pruebas, ejemplos de configuración y esta guía. No incluye `.env`, `node_modules`, la base con información real ni claves de proveedores. El envío real de Gmail/SMS depende de las credenciales y permisos que configure el equipo receptor. WhatsApp queda pendiente de integrar.
