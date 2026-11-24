const test = require('node:test'), assert = require('node:assert/strict');
const gmail = require('../services/gmailService');
const VARS = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
const conVars = (activo, fn) => async () => { const g = {}; VARS.forEach(k => { g[k] = process.env[k]; activo ? (process.env[k] = k === 'GMAIL_USER' ? 'clinica@gmail.com' : 'valor-' + k) : delete process.env[k]; });
  try { await fn(); } finally { gmail._usarClienteDePrueba(null); VARS.forEach(k => g[k] === undefined ? delete process.env[k] : (process.env[k] = g[k])); } };
const decodificar = raw => Buffer.from(raw, 'base64url').toString('utf8');

test('sin variables GMAIL_* no envía y dice cuáles faltan', conVars(false, async () => {
  assert.equal(gmail.configurado(), false);
  await assert.rejects(gmail.enviarCorreo('a@b.com', 'x', '<p>x</p>'), e => e.codigo === 'NO_CONFIGURADO' && /GMAIL_CLIENT_ID/.test(e.message));
}));

test('arma el mensaje con tildes codificadas, HTML en base64 y sin inyección de cabeceras', () => {
  const mime = gmail.construirMime({ desde: 'clinica@gmail.com', para: 'juan@correo.com', asunto: 'Confirmación de turno - ClínicaMed\r\nBcc: espia@x.com', html: '<p>Hola Pérez</p>' });
  assert.match(mime, /^From: =\?UTF-8\?B\?.+\?= <clinica@gmail\.com>/); assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.doesNotMatch(mime, /^Bcc:/m); assert.match(mime, /Content-Transfer-Encoding: base64/);
  assert.equal(Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8'), '<p>Hola Pérez</p>');
  assert.throws(() => gmail.construirMime({ desde: 'clinica@gmail.com', para: 'no-es-un-correo', asunto: 'x', html: 'x' }), e => e.codigo === 'DESTINATARIO');
});

test('envía por la API de Gmail y devuelve el id', conVars(true, async () => {
  let recibido; gmail._usarClienteDePrueba({ users: { messages: { send: async a => { recibido = a; return { data: { id: 'abc123' } }; } } } });
  const r = await gmail.enviarCorreo('juan@correo.com', 'Prueba', '<p>Hola</p>');
  assert.equal(r.id, 'abc123'); assert.equal(recibido.userId, 'me'); assert.match(decodificar(recibido.requestBody.raw), /To: juan@correo\.com/);
}));

test('traduce errores de Gmail: credenciales, permisos y no disponible (este sí es reintentable)', conVars(true, async () => {
  const falla = e => gmail._usarClienteDePrueba({ users: { messages: { send: async () => { throw e; } } } });
  falla(Object.assign(new Error('invalid_grant'), { code: 400 })); await assert.rejects(gmail.enviarCorreo('a@b.com', 'x', 'x'), e => e.codigo === 'CREDENCIALES' && !e.reintentable);
  falla(Object.assign(new Error('forbidden'), { code: 403 })); await assert.rejects(gmail.enviarCorreo('a@b.com', 'x', 'x'), e => e.codigo === 'PERMISOS');
  falla(Object.assign(new Error('backend error'), { code: 503 })); await assert.rejects(gmail.enviarCorreo('a@b.com', 'x', 'x'), e => e.codigo === 'NO_DISPONIBLE' && e.reintentable === true);
  falla(new Error('getaddrinfo ENOTFOUND gmail.googleapis.com')); await assert.rejects(gmail.enviarCorreo('a@b.com', 'x', 'x'), e => e.codigo === 'NO_DISPONIBLE');
}));
