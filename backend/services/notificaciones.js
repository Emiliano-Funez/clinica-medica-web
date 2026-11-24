// Módulo unificado de notificaciones: elige canal (automático o manual), evita duplicados,
// registra cada envío y reintenta lo que falló por causas pasajeras.
// No toca la base ni los proveedores directamente: usa un "repo" y "canales" que se le inyectan (así se puede probar).
const plantillas = require('./plantillas');

const TZ = 'America/Argentina/Buenos_Aires';
const CANALES_VALIDOS = ['auto', 'email', 'sms', 'whatsapp', 'ninguno'];

// Fecha y hora "de pared" en Argentina (los turnos se guardan en hora local).
function enArgentina(fecha) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(fecha)) p[x.type] = x.value;
  return { hora: +p.hour, texto: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` };
}

const mascaraCorreo = e => { const [u, d] = String(e).split('@'); return d ? u.slice(0, 2) + '***@' + d : '***'; };
const mascaraTel = t => '***' + String(t).replace(/\D/g, '').slice(-4);
const numero = (v, def) => (v === undefined || v === '' || isNaN(+v) ? def : +v);

function canalesPorDefecto(env = process.env, servicios = {}) {
  const gmail = servicios.gmail || require('./gmailService');
  const sms = servicios.sms || require('./smsService');
  const wa = servicios.whatsapp || require('./whatsappService');
  return {
    email: { etiqueta: 'correo', dato: 'correo electrónico', configurado: () => gmail.configurado(), destino: p => p.email, mascara: mascaraCorreo,
      contenido: (t, d) => plantillas.correo(t, d), enviar: (dest, c) => gmail.enviarCorreo(dest, c.asunto, c.html) },
    sms: { etiqueta: 'SMS', dato: 'teléfono', configurado: () => sms.configurado(), destino: p => p.telefono, mascara: mascaraTel,
      contenido: (t, d) => plantillas.sms(t, d), enviar: (dest, c) => sms.enviarSMS(dest, c.texto),
      horario: { desde: numero(env.SMS_HORA_DESDE, 8), hasta: numero(env.SMS_HORA_HASTA, 22) } },
    whatsapp: { etiqueta: 'WhatsApp', dato: 'teléfono', configurado: () => wa.configurado(), destino: p => p.telefono, mascara: mascaraTel,
      contenido: (t, d) => ({ texto: plantillas.sms(t, d).texto }), enviar: (dest, c) => wa.enviarWhatsApp(dest, c.texto) }
  };
}

function crearNotificador({ repo, canales, config = {}, ahora = () => new Date(), log = console }) {
  const cfg = { canalPredeterminado: 'auto', canalesAuto: ['email', 'sms'], maxIntentos: 3, sede: { nombre: 'ClínicaMed', direccion: '' }, ...config };
  const secretos = () => ['SMS_MASIVOS_API_KEY', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'WHATSAPP_ACCESS_TOKEN'].map(k => (process.env[k] || '').trim()).filter(s => s.length > 5);
  const limpiar = t => secretos().reduce((x, s) => x.split(s).join('***'), String(t)).slice(0, 300);

  const claveDe = (tipo, t) => {
    if (tipo === 'confirmacion') return 'confirmacion:' + t.estado;
    if (tipo === 'modificacion' || tipo.startsWith('recordatorio_')) return `${tipo}:${t.fecha} ${t.hora}`;
    return tipo;
  };
  const datosPlantilla = t => ({ paciente: t.paciente, medico: t.medico, especialidad: t.especialidad, fecha: t.fecha, hora: t.hora, estado: t.estado, sede: cfg.sede });
  const hayCanales = () => Object.values(canales).some(c => c.configurado());
  const disponibles = () => Object.fromEntries(Object.entries(canales).map(([k, c]) => [k, c.configurado()]));

  async function procesarCanal(c, { turno, tipo, clave, forzar, reintento, viables, modo }) {
    const ad = canales[c], dest = ad.destino(turno.paciente);
    const motivo = !dest ? `El paciente no tiene ${ad.dato} registrado.` : !ad.configurado() ? `El canal ${ad.etiqueta} no está configurado en el sistema.` : null;
    const base = { idTurno: turno.id, idPaciente: turno.paciente.id, tipo, clave, canal: c, destino: dest ? ad.mascara(dest) : null };

    if (motivo) {
      if (modo === 'auto' && viables.length) return { canal: c, estado: 'omitido', silencioso: true };
      const r = await repo.reservar(base);
      if (r.estado !== 'enviado') await repo.marcar(r.id, 'omitido', { error: motivo, intentos: r.intentos });
      return { canal: c, estado: 'omitido', error: motivo };
    }

    const r = await repo.reservar(base);
    if (!r.nueva) {   // ya existe un registro: evitar duplicados salvo reenvío manual o reintento programado
      if (r.estado === 'enviado' && !forzar) return { canal: c, estado: 'enviado', duplicado: true };
      if (r.estado === 'pendiente' && r.minutos < 10 && !forzar && !reintento) return { canal: c, estado: 'pendiente', duplicado: true };
      if (r.estado === 'error' && r.intentos >= cfg.maxIntentos && !forzar) return { canal: c, estado: 'error', duplicado: true, error: 'Ya falló y no se reintenta automáticamente.' };
    }

    if (ad.horario) {
      const h = enArgentina(ahora()).hora;
      if (h < ad.horario.desde || h >= ad.horario.hasta) {
        const e = `Fuera del horario permitido para ${ad.etiqueta} (${ad.horario.desde}:00 a ${ad.horario.hasta}:00). Se enviará en la próxima franja.`;
        await repo.marcar(r.id, 'pendiente', { error: e, intentos: r.intentos });
        return { canal: c, estado: 'pendiente', error: e };
      }
    }

    try {
      const res = await ad.enviar(dest, ad.contenido(tipo, datosPlantilla(turno)));
      const estado = res && res.prueba ? 'prueba' : 'enviado';
      await repo.marcar(r.id, estado, { proveedor: res && res.id, error: null, intentos: r.intentos + 1 });
      return { canal: c, estado };
    } catch (e) {
      const msg = limpiar(e.message);
      await repo.marcar(r.id, 'error', { error: msg, intentos: e.reintentable === true ? r.intentos + 1 : cfg.maxIntentos });
      log.error(`[notificaciones] ${ad.etiqueta} turno ${turno.id} (${tipo}): ${msg}`);
      return { canal: c, estado: 'error', error: msg };
    }
  }

  // Envía el aviso `tipo` de un turno. canal: auto | email | sms | whatsapp | ninguno
  async function notificar({ idTurno, tipo, clave, canal, forzar = false, reintento = false }) {
    canal = canal || cfg.canalPredeterminado;
    if (canal === 'ninguno') return [];
    if (canal !== 'auto' && !canales[canal]) return [{ canal, estado: 'error', error: 'Canal inválido.' }];
    const turno = await repo.turnoCompleto(idTurno);
    if (!turno) return [{ canal: null, estado: 'error', error: 'Turno inexistente.' }];
    clave = clave || claveDe(tipo, turno);
    const modo = canal === 'auto' ? 'auto' : 'manual';
    const lista = modo === 'auto' ? cfg.canalesAuto.filter(c => canales[c]) : [canal];
    const viables = lista.filter(c => canales[c].destino(turno.paciente) && canales[c].configurado());
    const res = await Promise.all(lista.map(c => procesarCanal(c, { turno, tipo, clave, forzar, reintento, viables, modo })
      .catch(e => { log.error('[notificaciones] error inesperado:', limpiar(e.message)); return { canal: c, estado: 'error', error: limpiar(e.message) }; })));
    return res.filter(r => !r.silencioso);
  }

  // Recordatorios: 24 h antes (ventana de 1 h) y 2 h antes (ventana de 30 min). Pensado para correr cada 15 minutos.
  async function recordatorios() {
    const ahoraD = ahora(); let enviados = 0;
    for (const [tipo, desdeMin, hastaMin] of [['recordatorio_24h', 23 * 60, 24 * 60], ['recordatorio_2h', 90, 120]]) {
      const turnos = await repo.turnosEntre(enArgentina(new Date(ahoraD.getTime() + desdeMin * 60000)).texto, enArgentina(new Date(ahoraD.getTime() + hastaMin * 60000)).texto);
      for (const t of turnos) {
        const r = await notificar({ idTurno: t.id, tipo });
        if (r.some(x => (x.estado === 'enviado' || x.estado === 'prueba') && !x.duplicado)) enviados++;
      }
    }
    return enviados;
  }

  // Reintenta avisos pendientes (por horario) o fallidos por causas pasajeras, si siguen vigentes.
  async function reintentar() {
    let n = 0;
    for (const f of await repo.pendientesDeReintento(cfg.maxIntentos)) {
      const turno = await repo.turnoCompleto(f.id_turno);
      if (!turno) continue;
      let vigente = null;
      if (['cancelado', 'atendido'].includes(turno.estado) && f.tipo !== 'cancelacion') vigente = 'El turno ya no está activo.';
      else if (f.clave !== claveDe(f.tipo, turno)) vigente = 'El turno cambió desde que se generó este aviso.';
      else if (f.tipo !== 'cancelacion' && `${turno.fecha} ${turno.hora}:00` < enArgentina(ahora()).texto) vigente = 'El turno ya pasó.';
      if (vigente) { await repo.marcar(f.id, 'omitido', { error: vigente, intentos: f.intentos }); continue; }
      const r = await notificar({ idTurno: f.id_turno, tipo: f.tipo, clave: f.clave, canal: f.canal, reintento: true });
      if (r.some(x => x.estado === 'enviado' || x.estado === 'prueba')) n++;
    }
    return n;
  }

  return { notificar, recordatorios, reintentar, hayCanales, disponibles, claveDe, historial: id => repo.listar(id), resumen: () => repo.resumen() };
}

module.exports = { crearNotificador, canalesPorDefecto, CANALES_VALIDOS, enArgentina };
