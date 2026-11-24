const test = require('node:test'), assert = require('node:assert/strict');
const { crearNotificador } = require('../services/notificaciones');
const { RepoFalso, canalFalso, turnoBase, silencio, error } = require('./helpers');

// Horas de Argentina (UTC-3): 2026-11-22T13:30Z = 10:30 del 22/11.
const AR = (iso) => () => new Date(iso);
function armar({ turno = turnoBase(), turnos, email = {}, sms = {}, whatsapp = { configurado: false }, ahora = AR('2026-11-20T15:00:00Z'), config } = {}) {
  const repo = new RepoFalso(turnos || { [turno.id]: turno });
  const canales = { email: Object.assign(canalFalso(email), { campo: 'email', dato: 'correo electrónico' }), sms: Object.assign(canalFalso({ horario: { desde: 8, hasta: 22 }, ...sms }), { campo: 'telefono', dato: 'teléfono' }),
    whatsapp: Object.assign(canalFalso(whatsapp), { campo: 'telefono' }) };
  const n = crearNotificador({ repo, canales, ahora, log: silencio, config });
  return { repo, canales, n };
}

test('confirmación automática: correo y SMS si hay ambos datos', async () => {
  const { n, canales, repo } = armar();
  const r = await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.deepEqual(r.map(x => [x.canal, x.estado]).sort(), [['email', 'enviado'], ['sms', 'enviado']]);
  assert.equal(canales.email.enviados.length, 1); assert.equal(canales.sms.enviados.length, 1);
  assert.deepEqual(repo.filas.map(f => f.estado), ['enviado', 'enviado']);
  assert.ok(repo.filas.every(f => f.idTurno === 1 && f.idPaciente === 9 && f.tipo === 'confirmacion'));
});

test('solo correo, o solo teléfono: se usa el canal disponible', async () => {
  let t = armar({ turno: turnoBase({ paciente: { id: 9, nombre: 'J', apellido: 'P', email: 'a@b.com', telefono: null } }) });
  assert.deepEqual((await t.n.notificar({ idTurno: 1, tipo: 'confirmacion' })).map(x => x.canal), ['email']); assert.equal(t.repo.filas.length, 1);
  t = armar({ turno: turnoBase({ paciente: { id: 9, nombre: 'J', apellido: 'P', email: null, telefono: '2994123456' } }) });
  assert.deepEqual((await t.n.notificar({ idTurno: 1, tipo: 'confirmacion' })).map(x => x.canal), ['sms']); assert.equal(t.canales.sms.enviados.length, 1);
});

test('sin ningún dato de contacto: queda registrado que no se pudo enviar', async () => {
  const { n, repo } = armar({ turno: turnoBase({ paciente: { id: 9, nombre: 'J', apellido: 'P', email: null, telefono: null } }) });
  const r = await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.ok(r.every(x => x.estado === 'omitido')); assert.equal(repo.filas.length, 2); assert.match(repo.fila('sms').error, /no tiene teléfono/);
});

test('si un canal falla, el otro se envía igual y el error queda registrado', async () => {
  const { n, canales, repo } = armar({ email: { falla: error(true, 'Gmail no está disponible') } });
  const r = await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.equal(r.find(x => x.canal === 'email').estado, 'error'); assert.equal(r.find(x => x.canal === 'sms').estado, 'enviado'); assert.equal(canales.sms.enviados.length, 1);
  assert.equal(repo.fila('email').error, 'Gmail no está disponible'); assert.equal(repo.fila('email').intentos, 1);
});

test('no envía confirmaciones duplicadas por el mismo turno; el reenvío manual sí', async () => {
  const { n, canales } = armar();
  await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  const otra = await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.ok(otra.every(x => x.duplicado)); assert.equal(canales.email.enviados.length, 1);
  await n.notificar({ idTurno: 1, tipo: 'confirmacion', forzar: true }); assert.equal(canales.email.enviados.length, 2);
});

test('selección manual de canal: ninguno, uno solo, sin dato, y WhatsApp todavía no disponible', async () => {
  const { n, canales, repo } = armar({ turno: turnoBase({ paciente: { id: 9, nombre: 'J', apellido: 'P', email: 'a@b.com', telefono: null } }) });
  assert.deepEqual(await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'ninguno' }), []); assert.equal(repo.filas.length, 0);
  const s = await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'sms' });
  assert.equal(s[0].estado, 'omitido'); assert.equal(canales.sms.enviados.length, 0);
  const conTel = armar();   // paciente con teléfono: el motivo pasa a ser que WhatsApp todavía no está configurado
  const w = await conTel.n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'whatsapp' });
  assert.equal(w[0].estado, 'omitido'); assert.match(w[0].error, /no está configurado/); assert.equal(conTel.canales.whatsapp.enviados.length, 0);
  const e = await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'email' }); assert.equal(e[0].estado, 'enviado');
});

test('turno pendiente y luego confirmado generan dos avisos distintos (no son duplicados)', async () => {
  const t = turnoBase({ estado: 'pendiente' }); const { n, canales } = armar({ turno: t });
  await n.notificar({ idTurno: 1, tipo: 'confirmacion' }); t.estado = 'confirmado'; await n.notificar({ idTurno: 1, tipo: 'confirmado' });
  assert.equal(canales.email.enviados.length, 2);
});

test('SMS fuera de horario (08 a 22 hs): queda pendiente y sale en la próxima franja; el correo sale en el momento', async () => {
  let ahora = new Date('2026-11-20T02:00:00Z');   // 23:00 en Argentina
  const { n, canales, repo } = armar({ ahora: () => ahora, turno: turnoBase({ fecha: '2026-11-25' }) });
  const r = await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.equal(r.find(x => x.canal === 'sms').estado, 'pendiente'); assert.equal(canales.sms.enviados.length, 0); assert.equal(canales.email.enviados.length, 1);
  ahora = new Date('2026-11-20T12:00:00Z');       // 09:00
  assert.equal(await n.reintentar(), 1); assert.equal(canales.sms.enviados.length, 1); assert.equal(repo.fila('sms').estado, 'enviado');
});

test('reintentos: lo pasajero se reintenta y se corrige; lo definitivo (credenciales, saldo) no', async () => {
  const { n, canales, repo } = armar({ email: { falla: error(true, 'Gmail no está disponible') }, sms: { falla: error(false, 'Saldo insuficiente') } });
  await n.notificar({ idTurno: 1, tipo: 'confirmacion' });
  assert.equal(repo.fila('sms').intentos, 3);                       // definitivo: no vuelve a intentarse
  canales.email.falla = null; canales.sms.falla = null;
  assert.equal(await n.reintentar(), 1); assert.equal(repo.fila('email').estado, 'enviado'); assert.equal(repo.fila('sms').estado, 'error');
});

test('un aviso viejo no se reintenta si el turno se canceló o ya pasó', async () => {
  const t = turnoBase({ fecha: '2026-11-25' }); const { n, canales, repo } = armar({ turno: t, email: { falla: error(true) }, ahora: AR('2026-11-20T15:00:00Z') });
  await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'email' }); t.estado = 'cancelado'; canales.email.falla = null;
  assert.equal(await n.reintentar(), 0); assert.equal(repo.fila('email').estado, 'omitido'); assert.equal(canales.email.enviados.length, 0);
});

test('recordatorio de 24 h: lo envía una vez, solo a turnos confirmados', async () => {
  const turnos = { 1: turnoBase({ id: 1, hora: '10:30' }), 2: turnoBase({ id: 2, estado: 'pendiente', hora: '10:30' }), 3: turnoBase({ id: 3, estado: 'cancelado', hora: '10:30' }), 4: turnoBase({ id: 4, hora: '16:00' }) };
  const { n, canales, repo } = armar({ turnos, ahora: AR('2026-11-22T13:30:00Z') });   // 10:30 del 22/11 → turno del 23/11 10:30 está a 24 h
  assert.equal(await n.recordatorios(), 1); assert.equal(canales.email.enviados.length, 1); assert.ok(repo.filas.every(f => f.idTurno === 1 && f.tipo === 'recordatorio_24h'));
  assert.equal(await n.recordatorios(), 0); assert.equal(canales.email.enviados.length, 1);   // sin duplicados
});

test('recordatorio de 2 h: sale en su ventana y no antes', async () => {
  const t = turnoBase({ hora: '10:30', fecha: '2026-11-23' });
  let a = armar({ turno: t, ahora: AR('2026-11-23T11:30:00Z') });   // 08:30 → faltan 2 h
  assert.equal(await a.n.recordatorios(), 1); assert.equal(a.repo.filas[0].tipo, 'recordatorio_2h');
  a = armar({ turno: t, ahora: AR('2026-11-23T10:00:00Z') });       // 07:00 → faltan 3 h 30
  assert.equal(await a.n.recordatorios(), 0);
});

test('si el turno se reprograma, el recordatorio nuevo se envía igual (otra clave) y no se pierde', async () => {
  const t = turnoBase({ hora: '10:30' }); let ahora = new Date('2026-11-22T13:30:00Z');
  const { n, canales } = armar({ turno: t, ahora: () => ahora });
  assert.equal(await n.recordatorios(), 1);                       // recordatorio del turno de las 10:30
  t.hora = '11:00'; ahora = new Date('2026-11-22T14:00:00Z');     // el turno pasa a las 11:00
  assert.equal(await n.recordatorios(), 1); assert.equal(canales.email.enviados.length, 2);
});

test('aviso de modificación y de cancelación', async () => {
  const { n, canales } = armar();
  await n.notificar({ idTurno: 1, tipo: 'modificacion' }); await n.notificar({ idTurno: 1, tipo: 'cancelacion' });
  assert.deepEqual(canales.email.enviados.map(e => e.cont.texto.split(':')[0]), ['modificacion', 'cancelacion']);
});

test('modo prueba (TEST=1): se registra como "prueba" y no bloquea el envío real posterior', async () => {
  const { n, canales, repo } = armar({ email: { prueba: true } });
  await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'email' }); assert.equal(repo.fila('email').estado, 'prueba');
  canales.email.enviar = async (d, c) => { canales.email.enviados.push({ d, c }); return { id: 'real' }; };
  await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'email' }); assert.equal(repo.fila('email').estado, 'enviado'); assert.equal(canales.email.enviados.length, 2);   // la prueba + el envío real
});

test('los secretos nunca quedan en el registro de errores', async () => {
  process.env.SMS_MASIVOS_API_KEY = 'SECRETO-MUY-LARGO-123';
  try {
    const { n, repo } = armar({ sms: { falla: error(false, 'rechazó SECRETO-MUY-LARGO-123 por algo') } });
    await n.notificar({ idTurno: 1, tipo: 'confirmacion', canal: 'sms' });
    assert.ok(!repo.fila('sms').error.includes('SECRETO-MUY-LARGO-123')); assert.match(repo.fila('sms').error, /\*\*\*/);
  } finally { delete process.env.SMS_MASIVOS_API_KEY; }
});

test('turno inexistente: no rompe', async () => { const { n } = armar(); const r = await n.notificar({ idTurno: 99, tipo: 'confirmacion' }); assert.equal(r[0].estado, 'error'); });
