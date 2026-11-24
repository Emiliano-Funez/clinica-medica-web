const test = require('node:test'), assert = require('node:assert/strict');
const sms = require('../services/smsService');
const { sanitizarSMS } = require('../services/texto');

const conEntorno = (vars, fn) => async () => { const g = {}; for (const k of Object.keys(vars)) { g[k] = process.env[k]; if (vars[k] === null) delete process.env[k]; else process.env[k] = vars[k]; }
  const fetchOriginal = global.fetch; try { await fn(); } finally { global.fetch = fetchOriginal; for (const k of Object.keys(g)) g[k] === undefined ? delete process.env[k] : (process.env[k] = g[k]); } };
const simular = (estado, cuerpo, capturar = {}) => { global.fetch = async (url, op) => { capturar.url = url; capturar.params = new URLSearchParams(op.body.toString()); return { ok: estado < 400, status: estado, text: async () => cuerpo }; }; };

test('normaliza teléfonos argentinos a 10 dígitos', () => {
  for (const [entrada, esperado] of [['2994123456', '2994123456'], ['0299 4123456', '2994123456'], ['299 15 4123456', '2994123456'], ['0299-15-4123456', '2994123456'],
    ['011 15 5555-1234', '1155551234'], ['+54 9 299 4123456', '2994123456'], ['+542994123456', '2994123456'], ['5492994123456', '2994123456'], ['123', null], ['', null], [null, null]])
    assert.equal(sms.normalizarTelefono(entrada), esperado, String(entrada));
});

test('el texto queda sin tildes, ñ, emojis ni símbolos raros', () => {
  assert.equal(sanitizarSMS('¡Hola Muñoz! Tu turno está listo 😀 – Dra. María'), 'Hola Munoz! Tu turno esta listo - Dra. Maria');
});

test('rechaza mensajes de más de 160 caracteres', () => { assert.throws(() => sms.prepararTexto('a'.repeat(161)), /160/); assert.equal(sms.prepararTexto('a'.repeat(160)).length, 160); });

test('interpreta las respuestas del proveedor', () => {
  assert.equal(sms.interpretarRespuesta('1', true).ok, true);
  assert.equal(sms.interpretarRespuesta('0', false).ok, true);
  assert.equal(sms.interpretarRespuesta('0', true).ok, false);        // con TEST=1 se espera "1"
  assert.equal(sms.interpretarRespuesta('Saldo insuficiente', false).error.codigo, 'SALDO');
  assert.equal(sms.interpretarRespuesta('APIKEY invalida', false).error.codigo, 'CREDENCIALES');
  const raro = sms.interpretarRespuesta('algo inesperado', false);
  assert.equal(raro.ok, false); assert.equal(raro.error.codigo, 'RESPUESTA'); assert.equal(raro.error.reintentable, false);
});

test('sin API key no envía', conEntorno({ SMS_MASIVOS_API_KEY: null }, async () => {
  await assert.rejects(sms.enviarSMS('2994123456', 'hola'), e => e.codigo === 'NO_CONFIGURADO');
}));

test('modo prueba agrega TEST=1 y usa HTTPS, POST y el formato del proveedor', conEntorno({ SMS_MASIVOS_API_KEY: 'CLAVE-SECRETA-123', SMS_MASIVOS_URL: 'https://servicio.smsmasivos.com.ar/enviar_sms.asp', SMS_MASIVOS_TEST: '1' }, async () => {
  const cap = {}; simular(200, '1', cap);
  const r = await sms.enviarSMS('0299 15 4123456', 'Hola Muñoz');
  assert.equal(r.prueba, true); assert.equal(cap.params.get('TEST'), '1'); assert.equal(cap.params.get('TOS'), '2994123456');
  assert.equal(cap.params.get('TEXTO'), 'Hola Munoz'); assert.equal(cap.params.get('API'), '1'); assert.match(cap.url, /^https:/);
}));

test('envío real: respuesta 0 = procesado, y no manda TEST', conEntorno({ SMS_MASIVOS_API_KEY: 'CLAVE-SECRETA-123', SMS_MASIVOS_TEST: '0' }, async () => {
  const cap = {}; simular(200, '0', cap);
  const r = await sms.enviarSMS('2994123456', 'Hola'); assert.equal(r.prueba, false); assert.equal(cap.params.has('TEST'), false);
}));

test('saldo insuficiente, error HTTP y red: códigos y reintento correctos; la API key no se filtra', conEntorno({ SMS_MASIVOS_API_KEY: 'CLAVE-SECRETA-123', SMS_MASIVOS_TEST: '0' }, async () => {
  simular(200, 'ERROR: saldo insuficiente CLAVE-SECRETA-123'); await assert.rejects(sms.enviarSMS('2994123456', 'x'), e => e.codigo === 'SALDO' && !e.message.includes('CLAVE-SECRETA-123'));
  simular(500, 'boom'); await assert.rejects(sms.enviarSMS('2994123456', 'x'), e => e.codigo === 'HTTP' && e.reintentable === true && /500/.test(e.message));
  simular(400, 'boom'); await assert.rejects(sms.enviarSMS('2994123456', 'x'), e => e.codigo === 'HTTP' && e.reintentable === false);
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(sms.enviarSMS('2994123456', 'x'), e => e.codigo === 'RED' && e.reintentable === true);
}));

test('rechaza URL sin HTTPS y teléfonos inválidos', conEntorno({ SMS_MASIVOS_API_KEY: 'k'.repeat(10), SMS_MASIVOS_URL: 'http://servicio.smsmasivos.com.ar/enviar_sms.asp' }, async () => {
  await assert.rejects(sms.enviarSMS('2994123456', 'x'), e => e.codigo === 'URL');
  process.env.SMS_MASIVOS_URL = 'https://servicio.smsmasivos.com.ar/enviar_sms.asp';
  await assert.rejects(sms.enviarSMS('12345', 'x'), e => e.codigo === 'TELEFONO');
}));
