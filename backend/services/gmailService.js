// Envío de correos con Gmail API (OAuth2 + refresh token). Las credenciales salen solo de .env.
const REQUERIDAS = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];

class CorreoError extends Error {
  // reintentable=true solo cuando conviene volver a probar (Gmail caído, red, límite de uso).
  constructor(codigo, mensaje, reintentable = false) { super(mensaje); this.name = 'CorreoError'; this.codigo = codigo; this.reintentable = reintentable; }
}

const configurado = () => REQUERIDAS.every(k => (process.env[k] || '').trim());
const faltantes = () => REQUERIDAS.filter(k => !(process.env[k] || '').trim());

let cliente = null;
function getCliente() {
  if (cliente) return cliente;
  const { google } = require('googleapis');   // se carga recién al enviar, así la app arranca aunque Gmail no esté configurado
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return (cliente = google.gmail({ version: 'v1', auth }));
}

const linea = v => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();                 // evita inyección de cabeceras
const codificar = t => (/^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + Buffer.from(t, 'utf8').toString('base64') + '?=');  // RFC 2047: tildes en asunto/nombre
const EMAIL_OK = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

function construirMime({ desde, nombreRemitente = 'ClínicaMed', para, asunto, html }) {
  para = linea(para); desde = linea(desde);
  if (!EMAIL_OK.test(para)) throw new CorreoError('DESTINATARIO', 'El correo del paciente no es válido.');
  if (!EMAIL_OK.test(desde)) throw new CorreoError('REMITENTE', 'GMAIL_USER no es un correo válido.');
  const cuerpo = Buffer.from(String(html), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  return ['From: ' + codificar(linea(nombreRemitente)) + ' <' + desde + '>', 'To: ' + para,
    'Subject: ' + codificar(linea(asunto).slice(0, 60)), 'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', cuerpo].join('\r\n');
}

function traducirError(e) {
  const estado = Number(e && (e.code || (e.response && e.response.status))) || 0;
  const texto = String((e && e.message) || e);
  if (/invalid_grant|invalid_client|unauthorized_client/i.test(texto) || estado === 401)
    return new CorreoError('CREDENCIALES', 'Gmail rechazó las credenciales (token vencido o revocado). Generá un refresh token nuevo.');
  if (estado === 403) return new CorreoError('PERMISOS', 'Gmail denegó el envío (revisá que la Gmail API esté habilitada y el permiso gmail.send).');
  if (estado === 429 || estado >= 500 || /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up/i.test(texto))
    return new CorreoError('NO_DISPONIBLE', 'Gmail no está disponible en este momento.', true);
  return new CorreoError('ERROR', 'Error al enviar el correo: ' + texto.slice(0, 150));
}

async function enviarCorreo(destinatario, asunto, html) {
  if (!configurado()) throw new CorreoError('NO_CONFIGURADO', 'Gmail API no está configurado (faltan: ' + faltantes().join(', ') + ').');
  const raw = Buffer.from(construirMime({ desde: process.env.GMAIL_USER, para: destinatario, asunto, html })).toString('base64url');
  try {
    const r = await getCliente().users.messages.send({ userId: 'me', requestBody: { raw } });
    return { id: r.data.id };
  } catch (e) { throw traducirError(e); }
}

module.exports = { enviarCorreo, configurado, faltantes, CorreoError, construirMime, traducirError, _usarClienteDePrueba: c => { cliente = c; } };
