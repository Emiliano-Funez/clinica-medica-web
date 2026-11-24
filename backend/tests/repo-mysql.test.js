// Prueba contra una base MariaDB/MySQL REAL (la de desarrollo). Se omite si no se pide expresamente:
//   TEST_DB=1 npm test        (con las variables DB_* del .env cargadas y el esquema importado)
const test = require('node:test'), assert = require('node:assert/strict');
require('dotenv').config();

test('repositorio MySQL: consulta del turno, registro único por canal, reintentos y resumen', { skip: process.env.TEST_DB !== '1' && 'Definí TEST_DB=1 para correr esta prueba contra la base' }, async () => {
  const mysql = require('mysql2/promise');
  const db = mysql.createPool({ host: process.env.DB_HOST || 'localhost', port: +process.env.DB_PORT || 3306, user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'clinicamed', dateStrings: true });
  const { crearRepoMysql } = require('../services/notificacionesRepo'); const repo = crearRepoMysql(db);
  const sufijo = String(Date.now()).slice(-7); let ids = {};
  try {
    const persona = async (n, a, rol) => { const [p] = await db.query('INSERT INTO persona(nombre,apellido,dni,email,contrasena,num_celular) VALUES(?,?,?,?,?,?)', [n, a, 'T' + sufijo + rol, `t${sufijo}${rol}@test.com`, 'x', rol === 'p' ? '299 15 4123456' : null]);
      const [r] = await db.query('INSERT INTO persona_rol(id_persona,id_rol) SELECT ?,id_rol FROM rol WHERE nombre=?', [p.insertId, rol === 'p' ? 'paciente' : 'especialista']); return { persona: p.insertId, rol: r.insertId }; };
    const pac = await persona('Juan', 'Pérez', 'p'), med = await persona('Dra. María', 'González', 'm');
    const [esp] = await db.query('SELECT id_especialidad id,nombre FROM especialidad LIMIT 1');
    await db.query('INSERT INTO especialista(id_persona_rol,id_especialidad,matricula) VALUES(?,?,?)', [med.rol, esp[0].id, 'T' + sufijo]);
    const [t] = await db.query("INSERT INTO turno(id_paciente,id_especialista,id_creador,fecha,horario,estado) VALUES(?,?,?,?,?,'confirmado')", [pac.rol, med.rol, pac.rol, '2026-11-23', '10:30']);
    ids = { pac, med, turno: t.insertId };

    const x = await repo.turnoCompleto(t.insertId);
    assert.equal(x.hora, '10:30'); assert.equal(x.fecha, '2026-11-23'); assert.equal(x.medico, 'Dra. María González'); assert.equal(x.especialidad, esp[0].nombre);
    assert.equal(x.paciente.nombre, 'Juan'); assert.equal(x.paciente.telefono, '299 15 4123456'); assert.match(x.paciente.email, /@test\.com$/);
    assert.equal(await repo.turnoCompleto(0), undefined);

    const d = { idTurno: t.insertId, idPaciente: pac.persona, tipo: 'confirmacion', clave: 'confirmacion:confirmado', canal: 'email', destino: 'ju***@test.com' };
    const a = await repo.reservar(d); assert.equal(a.nueva, true);
    const b = await repo.reservar(d); assert.equal(b.nueva, false); assert.equal(b.id, a.id); assert.equal(b.estado, 'pendiente');   // no se duplica
    await repo.marcar(a.id, 'error', { error: 'x'.repeat(500), intentos: 1 });
    assert.equal((await repo.reservar(d)).intentos, 1);
    assert.ok((await repo.pendientesDeReintento(3)).every(f => f.id !== a.id));   // recién actualizado: todavía no toca reintentar
    await db.query('UPDATE notificacion SET actualizado=NOW()-INTERVAL 20 MINUTE WHERE id_notificacion=?', [a.id]);
    assert.ok((await repo.pendientesDeReintento(3)).some(f => f.id === a.id));
    await repo.marcar(a.id, 'enviado', { proveedor: 'abc', intentos: 2 });
    const l = await repo.listar(t.insertId); assert.equal(l.length, 1); assert.equal(l[0].estado, 'enviado'); assert.equal(l[0].error, null);
    assert.ok((await repo.resumen()).some(f => f.turno === t.insertId));
    assert.ok((await repo.turnosEntre('2026-11-23 10:00:00', '2026-11-23 10:30:00')).some(f => f.id === t.insertId));   // límite superior inclusivo
    assert.ok(!(await repo.turnosEntre('2026-11-23 10:30:00', '2026-11-23 11:00:00')).some(f => f.id === t.insertId));  // límite inferior exclusivo
  } finally {
    if (ids.turno) { await db.query('DELETE FROM turno WHERE id_turno=?', [ids.turno]); }
    for (const k of ['pac', 'med']) if (ids[k]) await db.query('DELETE FROM persona WHERE id_persona=?', [ids[k].persona]);
    await db.end();
  }
});
