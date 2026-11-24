# ClinicaMed

Frontend web y backend de ClinicaMed. Esta guía explica cómo preparar el proyecto en otra computadora para una presentación local.

## Requisitos

- Node.js instalado.
- MySQL o MariaDB instalado y en ejecución.
- Visual Studio Code con Live Server, o cualquier servidor estático para abrir el frontend por HTTP.

## Preparar el proyecto

1. Cloná el repositorio o descargá el ZIP desde GitHub.
2. Abrí la carpeta del proyecto en Visual Studio Code.
3. En una terminal, instalá las dependencias del backend:

   ```powershell
   cd backend
   npm install
   Copy-Item .env.example .env
   ```

4. Editá `backend/.env` con la configuración de esa computadora. Completá los datos de MySQL/MariaDB, la clave de Google Maps y, si vas a probar correos, las credenciales OAuth de Gmail. El archivo `.env` no se sube a GitHub.

## Base de datos

La base de datos real no está incluida en GitHub. Para conservar sus datos, exportala desde la computadora original e importala en la nueva. También podés preparar una base nueva con:

```powershell
cd backend
mysql -u root -p < db/schema.sql
npm run seed
```

`npm run seed` carga usuarios de demostración. Si la base ya existía antes de agregar notificaciones, aplicá `db/migracion_notificaciones.sql` una sola vez.

## Iniciar el backend

Desde la carpeta `backend`, ejecutá:

```powershell
npm start
```

El servidor usa el puerto indicado por `PORT` en `.env` (por defecto, `3000`). La ruta `http://localhost:3000/api/sede` devuelve los datos que usa la página “Dónde nos encontramos”.

## Abrir el frontend

En Visual Studio Code, abrí `index.html` con Live Server. No abras el archivo directamente con `file://`. Para la configuración local predeterminada, el frontend se sirve en `http://localhost:5500` y se conecta al backend en `http://localhost:3000`.

El frontend está configurado inicialmente con el adaptador local de demostración (`adaptador: 'local'` en `js/config.js`). El backend tiene sus propias rutas de API; iniciar el backend no cambia por sí solo el adaptador del frontend.

## Google Maps y Gmail

- Maps requiere una clave válida con **Maps JavaScript API** habilitada. Completá `GOOGLE_MAPS_API_KEY`, `SEDE_DIRECCION`, `SEDE_LAT` y `SEDE_LNG`. En Google Cloud, restringí la clave por dominio.
- Gmail requiere credenciales OAuth válidas en las variables `GMAIL_*` del `.env`. Las credenciales son privadas y no deben subirse a GitHub.
- Si frontend y backend se alojan en dominios distintos, agregá el origen del frontend a `FRONTEND_ORIGINS` en `.env`.

## Archivos privados

`backend/.env` contiene contraseñas y claves privadas. Git lo ignora. Compartí esos valores por un medio seguro; no los pegues en el README ni los publiques en GitHub.
