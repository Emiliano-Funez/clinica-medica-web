// Textos de los avisos. Solo llevan datos del turno: nunca información clínica.
const { sanitizarSMS, escapeHtml: h } = require('./texto');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = n => String(n).padStart(2, '0');
function partes(iso) { const [y, m, d] = iso.split('-').map(Number); return { m, d, dia: DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }; }
const fechaLarga = iso => { const p = partes(iso); return `${p.dia} ${p.d} de ${MESES[p.m - 1]}`; };   // lunes 23 de noviembre
const fechaCorta = iso => { const p = partes(iso); return `${p.dia} ${dos(p.d)}/${dos(p.m)}`; };       // lunes 23/11

const ASUNTO = {
  confirmacion: 'Confirmación de turno - ClínicaMed',
  confirmado: 'Confirmación de turno - ClínicaMed',
  modificacion: 'Modificación de turno - ClínicaMed',
  cancelacion: 'Cancelación de turno - ClínicaMed',
  recordatorio_24h: 'Recordatorio de turno - ClínicaMed',
  recordatorio_2h: 'Recordatorio de turno - ClínicaMed'
};

// d = { paciente:{nombre,apellido}, medico, especialidad, fecha:'YYYY-MM-DD', hora:'HH:MM', estado, sede:{nombre,direccion} }
function introCorreo(tipo, d) {
  switch (tipo) {
    case 'confirmacion': return d.estado === 'pendiente' ? 'Recibimos tu solicitud de turno. Recepción la confirmará a la brevedad.' : 'Tu turno fue registrado correctamente.';
    case 'confirmado': return 'Tu turno fue confirmado.';
    case 'modificacion': return 'Tu turno fue modificado. Estos son los nuevos datos:';
    case 'cancelacion': return 'Tu turno fue cancelado.';
    case 'recordatorio_24h': return 'Te recordamos que tenés un turno en las próximas 24 horas.';
    case 'recordatorio_2h': return 'Te recordamos que tu turno es en aproximadamente 2 horas.';
    default: throw new Error('Tipo de aviso desconocido: ' + tipo);
  }
}

function correo(tipo, d) {
  const nombre = `${d.paciente.nombre} ${d.paciente.apellido}`.trim();
  const lugar = d.sede.direccion ? `${d.sede.nombre} - ${d.sede.direccion}` : d.sede.nombre;
  const items = [['Médico', d.medico], d.especialidad ? ['Especialidad', d.especialidad] : null,
    ['Día', fechaLarga(d.fecha)], ['Horario', `${d.hora} hs`], ['Lugar', lugar]].filter(Boolean);
  const cierre = tipo === 'cancelacion' ? 'Podés sacar un nuevo turno desde nuestra web.' : '¡Te esperamos!';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#16302c;max-width:520px">
<h2 style="color:#20615a;margin:0 0 12px">${h(d.sede.nombre)}</h2>
<p>Hola, ${h(nombre)}.</p><p>${h(introCorreo(tipo, d))}</p>
<ul>${items.map(([k, v]) => `<li><b>${k}:</b> ${h(v)}.</li>`).join('')}</ul>
<p>${cierre}</p></div>`;
  return { asunto: ASUNTO[tipo], html };
}

function sms(tipo, d) {
  const apellido = d.paciente.apellido;
  const fc = fechaCorta(d.fecha);
  const hs = d.hora;

  const texto = sanitizarSMS(
    `Hola ${apellido}. Tu turno es el ${fc} a las ${hs} hs.`
  );

  return { texto };
}
module.exports = { correo, sms, fechaLarga, fechaCorta };
