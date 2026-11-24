# ClinicaMed (Node + Express + MariaDB)

Probado con MariaDB 10.11 y Node 22.

1. Instalar dependencias: `npm install`
2. Crear la base: `mariadb -u root -p < db/schema.sql`
   (en Windows/XAMPP: `mysql -u root < db/schema.sql`, el cliente de MariaDB también se llama así)
3. Copiar `.env.example` a `.env` y completar DB_USER / DB_PASS y JWT_SECRET.
   Si querés un usuario propio en MariaDB:
   `CREATE USER 'clinica'@'localhost' IDENTIFIED BY 'tu_clave'; GRANT ALL ON clinicamed.* TO 'clinica'@'localhost';`
4. Cargar usuarios de demo: `npm run seed` (contraseña 1234)
5. Iniciar: `npm start` y abrir http://localhost:3000

Demo: martin@email.com (paciente) · laura@clinicamed.com (especialista) · recepcion@clinicamed.com (recepción)

Estructura: `server.js` (API) · `seed.js` (datos demo) · `db/schema.sql` (tablas del MER) · `public/index.html` (web).

## Google Maps (pantalla "Cómo llegar")

1. En Google Cloud Console creá una API key y habilitá **Maps JavaScript API**.
2. Restringí la key por **HTTP referrers** (ej. `http://localhost:3000/*` y tu dominio final).
3. En `.env` completá `GOOGLE_MAPS_API_KEY`, `SEDE_NOMBRE`, `SEDE_DIRECCION`, `SEDE_LAT` y `SEDE_LNG`.
4. Reiniciá el servidor. La pantalla está en el menú del paciente y en la página pública.

Sin key, la pantalla igual muestra la dirección y los botones "Cómo llegar" / "Abrir en Google Maps".

## Notificaciones (correo y SMS)

Cada vez que se registra, confirma, reprograma o cancela un turno, el paciente recibe un aviso. Además hay recordatorios 24 h y 2 h antes.
Detalle completo, variables, pruebas y pendientes: **`docs/NOTIFICACIONES.md`**.

Resumen rápido:
1. Si ya tenías la base cargada, corré `db/migracion_notificaciones.sql` (crea la tabla `notificacion`). Si es una instalación nueva, `db/schema.sql` ya la incluye.
2. `npm install` y completá en `.env` las variables `GMAIL_*` y `SMS_MASIVOS_*` (ver `.env.example`).
3. `npm test` corre las pruebas. `npm start` inicia el servidor y muestra qué canales quedaron activos.

