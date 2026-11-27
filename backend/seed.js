// Crea cuentas ficticias de demostración. No usar estas cuentas en producción.
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'base_de_datos_clinica',
  });
  try {
    const hash = await bcrypt.hash('Demo1234', 10);
    const usuarios = [
      ['Martín', 'Gutiérrez', '32456789', 'martin@email.com', 'PACIENTE'],
      ['Ana', 'Pereyra', '28114302', 'ana@email.com', 'PACIENTE'],
      ['Laura', 'Gómez', '20111222', 'laura@clinicamed.com', 'ESPECIALISTA', 'Clínica médica', 'MP-1001'],
      ['Martín', 'Pérez', '20111223', 'perez@clinicamed.com', 'ESPECIALISTA', 'Clínica médica', 'MP-1002'],
      ['Diego', 'Salas', '21333444', 'diego@clinicamed.com', 'ESPECIALISTA', 'Pediatría', 'MP-1003'],
      ['Carla', 'Ríos', '22333555', 'carla@clinicamed.com', 'ESPECIALISTA', 'Dermatología', 'MP-1004'],
      ['Sofía', 'Ibáñez', '23333666', 'sofia@clinicamed.com', 'ESPECIALISTA', 'Cardiología', 'MP-1005'],
      ['Sofía', 'López', '23333667', 'sofia.lopez@consultorio.com', 'ESPECIALISTA', 'Dermatología', 'MP-1006'],
      ['Recepción', 'Clínica', '30000000', 'recepcion@clinicamed.com', 'ADMINISTRATIVO'],
    ];

    for (const [nombre, apellido, dni, email, rol, especialidad, matricula] of usuarios) {
      const [existente] = await db.query('SELECT id_persona FROM persona WHERE email=? OR dni=?', [email, dni]);
      if (existente.length) continue;
      const [p] = await db.query(`INSERT INTO persona
        (nombre,apellido,dni,email,password_hash) VALUES(?,?,?,?,?)`, [nombre, apellido, dni, email, hash]);
      const [pr] = await db.query(`INSERT INTO persona_rol(id_persona,id_rol)
        SELECT ?,id_rol FROM rol WHERE UPPER(nombre)=?`, [p.insertId, rol]);
      if (especialidad) {
        const [[esp]] = await db.query('SELECT id_especialidad FROM especialidad WHERE nombre=?', [especialidad]);
        if (esp) await db.query('INSERT INTO persona_especialidad(id_persona_rol,id_especialidad,matricula) VALUES(?,?,?)',
          [pr.insertId, esp.id_especialidad, matricula]);
      }
    }
    console.log('Cuentas de demostración listas. Contraseña: Demo1234');
  } finally { await db.end(); }
})().catch(e => { console.error('No se pudo cargar la semilla:', e.code || e.message); process.exitCode = 1; });
