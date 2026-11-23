import mysql from 'mysql2';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resultado = dotenv.config({
    path: path.join(__dirname, '.env'),
    debug: true
});

if (resultado.error) {
    console.log('ERROR AL LEER .env:', resultado.error.message);
}

console.log('USUARIO:', process.env.DB_USER || 'NO ENCONTRADO');
console.log('BASE:', process.env.DB_NAME || 'NO ENCONTRADA');
console.log('PASSWORD CARGADA:', process.env.DB_PASSWORD ? 'SI' : 'NO');

const conexion = mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

conexion.connect((error) => {
    if (error) {
        console.log('ERROR MYSQL:', error.message);
        return;
    }

    console.log('¡CONEXION EXITOSA CON MYSQL!');
});

export default conexion;
