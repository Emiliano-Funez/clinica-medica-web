# ClinicaMed

Aplicación web para gestionar pacientes, turnos, recepción, agenda de especialistas e historial clínico. El backend Express sirve también el frontend; no hace falta Live Server.

## Requisitos

- Node.js 18 o posterior.
- MySQL 8 o compatible con InnoDB.
- Git para clonar el repositorio.

## Instalación local en Windows

1. Cloná el repositorio y entrá a la carpeta:

   ```powershell
   git clone https://github.com/Emiliano-Funez/clinica-medica-web.git
   cd clinica-medica-web
   ```

2. Prepará la base de datos. Desde MySQL Workbench, abrí y ejecutá `backend/db/schema.sql`. El archivo crea `base_de_datos_clinica`, las tablas, los roles y las especialidades iniciales.

3. Creá la configuración local y ajustá los datos de MySQL:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

   Abrí `backend/.env`. Poné el usuario y la contraseña de MySQL de esa computadora. Si `root` no tiene contraseña, dejá `DB_PASS=` vacío. Cambiá `JWT_SECRET` por una frase privada larga.

4. Instalá e iniciá el backend:

   ```powershell
   cd backend
   npm ci
   npm run seed
   npm start
   ```

5. Abrí **http://localhost:3000**. El backend sirve allí la página y la API. Para detenerlo, volvé a la terminal y presioná `Ctrl+C`.

## Cuentas de demostración

La semilla crea cuentas ficticias con la clave `Demo1234`:

| Perfil | Email |
|---|---|
| Recepción | `recepcion@clinicamed.com` |
| Especialista (Dermatología) | `sofia.lopez@consultorio.com` |
| Paciente | `martin@email.com` |

Estas cuentas son solo para una base de práctica. `npm run seed` no modifica usuarios que ya tengan el mismo email o DNI.

## Servicios externos

El mapa requiere una clave propia de Google Maps JavaScript API en `GOOGLE_MAPS_API_KEY`. El envío real de correo Gmail y SMS requiere credenciales propias. Sin ellas, la aplicación y el flujo de turnos pueden ejecutarse, pero esos servicios externos no enviarán mensajes reales. WhatsApp todavía no está implementado.

## Datos y seguridad

- La base real no se incluye en GitHub. Cada instalación crea su base local con `backend/db/schema.sql`.
- `backend/.env` contiene secretos y está excluido del repositorio. No lo compartas ni lo reemplaces con el `.env.example` ya completado.
- Para actualizar una base anterior, consultá [la guía del backend](backend/GUIA_ENTREGA.md) y aplicá solo las migraciones que correspondan.
- No ejecutes `npm run seed` en una base con información real; carga pacientes, profesionales y recepción de demostración.

## Estructura

```text
clinicamed-web/
├── index.html
├── js/                 # lógica de las vistas y acceso a la API
├── pages/              # pantallas de la aplicación
├── scss/ y styles/     # estilos fuente y CSS compilado
└── backend/
    ├── server.js
    ├── db/             # esquema y migraciones SQL
    ├── services/       # notificaciones y servicios externos
    └── tests/          # pruebas del backend
```
