// Utilidades de texto compartidas por los canales.
// SMS: sin tildes, sin ñ, sin emojis ni caracteres fuera del juego básico (evita SMS partidos o con "?" ).
const sinTildes = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function sanitizarSMS(texto) {
  return sinTildes(texto)
    .replace(/[¡¿]/g, '')
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—•·]/g, '-')
    .replace(/[^A-Za-z0-9 .,;:!?()+\-/@#%&*='"_\n]/g, '')   // quita emojis y símbolos raros
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeHtml = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { sinTildes, sanitizarSMS, escapeHtml };
