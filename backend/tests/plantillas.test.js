const test = require('node:test'), assert = require('node:assert/strict');
const p = require('../services/plantillas');
const d = (extra = {}) => ({ paciente: { nombre: 'Juan', apellido: 'Pérez' }, medico: 'Dra. María González', especialidad: 'Clínica Médica', fecha: '2026-11-23', hora: '10:30', estado: 'confirmado', sede: { nombre: 'ClínicaMed', direccion: '' }, ...extra });
const TIPOS = ['confirmacion', 'confirmado', 'modificacion', 'cancelacion', 'recordatorio_24h', 'recordatorio_2h'];

test('fechas en español', () => { assert.equal(p.fechaLarga('2026-11-23'), 'lunes 23 de noviembre'); assert.equal(p.fechaCorta('2026-11-23'), 'lunes 23/11'); });

test('SMS de confirmación igual al ejemplo del documento', () => {
  assert.equal(p.sms('confirmacion', d()).texto, 'Hola Juan Perez. Tu turno en ClinicaMed fue confirmado para el lunes 23/11 a las 10:30 hs con Dra. Maria Gonzalez.');
});

test('todos los SMS entran en 160 caracteres y no llevan tildes, ni siquiera con nombres larguísimos', () => {
  const largo = d({ paciente: { nombre: 'Maximiliano José', apellido: 'Fernández de la Cruz Ibáñez' }, medico: 'Dra. María de los Ángeles González Ibarrechea', sede: { nombre: 'ClínicaMed', direccion: 'Av. Siempre Viva 1234, Neuquén' } });
  for (const t of TIPOS) for (const x of [d(), largo, d({ estado: 'pendiente' })]) { const s = p.sms(t, x).texto; assert.ok(s.length <= 160, `${t}: ${s.length}`); assert.match(s, /^[\x20-\x7e]+$/); }
});

test('correo con los datos pedidos: médico, especialidad, día, horario y lugar', () => {
  const c = p.correo('confirmacion', d({ sede: { nombre: 'ClínicaMed', direccion: 'Av. Siempre Viva 123' } }));
  assert.equal(c.asunto, 'Confirmación de turno - ClínicaMed');
  for (const t of ['Hola, Juan Pérez.', 'Tu turno fue registrado correctamente.', 'Dra. María González', 'Clínica Médica', 'lunes 23 de noviembre', '10:30 hs', 'Av. Siempre Viva 123', '¡Te esperamos!']) assert.ok(c.html.includes(t), t);
});

test('el correo escapa HTML (un nombre malicioso no inyecta código) y omite la especialidad si no hay', () => {
  const c = p.correo('cancelacion', d({ paciente: { nombre: '<script>alert(1)</script>', apellido: 'X' }, especialidad: null }));
  assert.ok(!c.html.includes('<script>')); assert.ok(!c.html.includes('Especialidad')); assert.equal(c.asunto, 'Cancelación de turno - ClínicaMed');
});

test('turno pendiente: el aviso dice que la recepción lo confirmará', () => { assert.match(p.correo('confirmacion', d({ estado: 'pendiente' })).html, /Recepción la confirmará/); });
test('tipo desconocido lanza error', () => { assert.throws(() => p.correo('xx', d())); assert.throws(() => p.sms('xx', d())); });
