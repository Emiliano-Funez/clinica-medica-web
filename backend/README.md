# ClinicaMed: API y base de datos

El servidor Express sirve el frontend y la API en el mismo origen: `http://localhost:3000`. La instalación completa desde cero está explicada en el [README principal](../README.md).

## Instalación rápida

1. En MySQL Workbench, ejecutá `db/schema.sql` para crear `base_de_datos_clinica`, sus tablas, roles, especialidades y restricciones.
2. Copiá `.env.example` como `.env` y completá los valores de conexión a MySQL y `JWT_SECRET`.
3. Desde esta carpeta ejecutá:

   ```powershell
   npm ci
   npm run seed
   npm start
   ```

4. Abrí `http://localhost:3000`.

## Cuentas locales de demostración

`npm run seed` agrega cuentas ficticias que no existan (clave `Demo1234`). Entre ellas:

- Recepción: `recepcion@clinicamed.com`
- Especialista, Dermatología: `sofia.lopez@consultorio.com`
- Paciente: `martin@email.com`

No ejecutar la semilla sobre una base con datos reales.

## Base existente

Antes de aplicar cambios, hacer una copia de seguridad. `db/migracion_notificaciones.sql` crea la tabla de notificaciones y agrega `persona.fecha_nacimiento` si falta. `db/migracion_turno_paciente_unico.sql` agrega una restricción para que cada paciente tenga como máximo un turno activo en la misma fecha y hora. Si detecta conflictos existentes, los muestra y no agrega el índice hasta que se resuelvan.

Para una base nueva, `db/schema.sql` ya incorpora ambas estructuras y restricciones.

## Servicios externos

- Google Maps requiere una clave propia en `GOOGLE_MAPS_API_KEY`.
- Gmail y SMS requieren credenciales de proveedor propias; sin ellas no se envían mensajes reales. SMS queda en modo de prueba con `SMS_MASIVOS_TEST=1`.
- WhatsApp está reservado y todavía no está implementado.

Ver [docs/NOTIFICACIONES.md](docs/NOTIFICACIONES.md) para configuración y flujo de avisos.
