console.log('INICIANDO CLINICAMED...');
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

import conexion from './database.js';

const app = express();

app.use(cors());
app.use(express.json());



app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ClínicaMed - Backend</title>

        <style>
            body {
                margin: 0;
                font-family: Arial, sans-serif;
                background: #eef3f8;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                color: #263445;
            }

            .panel {
                background: white;
                width: 90%;
                max-width: 600px;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 5px 25px rgba(0,0,0,0.08);
                text-align: center;
            }

            h1 {
                color: #1677a8;
                font-size: 32px;
                margin-bottom: 20px;
            }

            .estado {
                color: #16834a;
                font-size: 17px;
                font-weight: bold;
            }
        </style>
    </head>

    <body>
        <div class="panel">
            <h1>ClínicaMed</h1>

            <div class="estado">
                ● Servidor ClínicaMed funcionando
            </div>
        </div>
    </body>
    </html>
    `);
});


app.get('/prueba-db', (req, res) => {
    conexion.query('SELECT 1 AS conexion', (error, resultados) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(resultados);
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});