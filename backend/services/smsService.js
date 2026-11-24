// Envío de SMS con SMS Masivos (HTTPS + POST). La API key sale solo de .env y nunca se registra.
const { sanitizarSMS } = require('./texto');
const URL_POR_DEFECTO = 'https://servicio.smsmasivos.com.ar/enviar_sms.asp';

class SmsError extends Error {
  constructor(codigo, mensaje, reintentable = false) { super(mensaje); this.name = 'SmsError'; this.codigo = codigo; this.reintentable = reintentable; }
}

const configurado = () => Boolean((process.env.SMS_MASIVOS_API_KEY || '').trim());

// Teléfonos argentinos: sin 0 inicial, sin 15, 10 dígitos (código de área + número). Devuelve null si no se puede.
function normalizarTelefono(entrada) {
  if (!entrada) return null;
  let d = String(entrada).replace(/\D/g, '');
  if (d.startsWith('549')) d = d.slice(3); else if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length === 12) for (const i of [2, 3, 4]) if (d.slice(i, i + 2) === '15') { d = d.slice(0, i) + d.slice(i + 2); break; }
  return /^\d{10}$/.test(d) ? d : null;
}

function prepararTexto(mensaje) {
  const t = sanitizarSMS(mensaje);
  if (!t) throw new SmsError('TEXTO', 'El mensaje está vacío.');
  if (t.length > 160) throw new SmsError('TEXTO', `El mensaje tiene ${t.length} caracteres y el máximo es 160.`);
  return t;
}

// Según la documentación del proveedor: con TEST=1 la respuesta "1" indica prueba correcta;
// sin TEST la respuesta "0" indica que el mensaje fue procesado para su entrega. Cualquier otra
// respuesta se trata como error (sin reintento automático, para no duplicar un SMS que quizá salió).
// Los códigos de error propios del proveedor no figuran en la documentación recibida: ajustar acá cuando se tengan.
function interpretarRespuesta(texto, prueba) {
  const r = String(texto).trim();
  if (prueba ? r === '1' : r === '0') return { ok: true, prueba };
  const corto = r.replace(/\s+/g, ' ').slice(0, 120);
  if (/saldo|cr[eé]dito|insuficiente/i.test(r)) return { ok: false, error: new SmsError('SALDO', 'Saldo insuficiente en SMS Masivos.') };
  if (/api\s*key|apikey|clave|usuario|autentic|autoriz/i.test(r)) return { ok: false, error: new SmsError('CREDENCIALES', 'SMS Masivos rechazó la API key.') };
  return { ok: false, error: new SmsError('RESPUESTA', `Respuesta no reconocida de SMS Masivos: "${corto}"`) };
}

async function enviarSMS(telefono, mensaje, opciones = {}) {
  if (!configurado()) throw new SmsError('NO_CONFIGURADO', 'SMS Masivos no está configurado (falta SMS_MASIVOS_API_KEY).');
  const url = (process.env.SMS_MASIVOS_URL || URL_POR_DEFECTO).trim();
  if (!/^https:\/\//i.test(url)) throw new SmsError('URL', 'SMS_MASIVOS_URL debe usar HTTPS.');
  const destino = normalizarTelefono(telefono);
  if (!destino) throw new SmsError('TELEFONO', 'El teléfono del paciente no es válido (se esperan 10 dígitos con código de área).');
  const texto = prepararTexto(mensaje);
  const prueba = opciones.test !== undefined ? Boolean(opciones.test) : process.env.SMS_MASIVOS_TEST === '1';
  const params = new URLSearchParams({ APIKEY: process.env.SMS_MASIVOS_API_KEY.trim(), TOS: destino, TEXTO: texto, API: '1' });
  if (prueba) params.set('TEST', '1');

  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  let respuesta, cuerpo;
  try {
    respuesta = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: ctl.signal });
    cuerpo = await respuesta.text();
  } catch (e) {
    throw new SmsError('RED', e.name === 'AbortError' ? 'SMS Masivos no respondió a tiempo.' : 'No se pudo conectar con SMS Masivos.', true);
  } finally { clearTimeout(t); }

  if (!respuesta.ok) throw new SmsError('HTTP', `Error HTTP SMS: ${respuesta.status}`, respuesta.status >= 500 || respuesta.status === 429);
  const r = interpretarRespuesta(cuerpo, prueba);
  if (!r.ok) throw r.error;
  return { id: null, prueba: r.prueba };
}

module.exports = { enviarSMS, configurado, normalizarTelefono, prepararTexto, interpretarRespuesta, SmsError };
