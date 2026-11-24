// WhatsApp Cloud API (Meta): estructura preparada, SIN implementar todavía.
// Se completa cuando existan las credenciales de Meta. Hasta entonces el canal figura como "no configurado"
// y nunca se informa un envío que no ocurrió.
//
// Variables previstas en .env:
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_API_VERSION
const IMPLEMENTADO = false;
const REQUERIDAS = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_API_VERSION'];

const configurado = () => IMPLEMENTADO && REQUERIDAS.every(k => (process.env[k] || '').trim());

async function enviarWhatsApp() {
  const e = new Error('WhatsApp Cloud API todavía no está implementado.');
  e.codigo = 'NO_IMPLEMENTADO'; e.reintentable = false;
  throw e;
}

module.exports = { enviarWhatsApp, configurado, IMPLEMENTADO, REQUERIDAS };
