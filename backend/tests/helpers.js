// Piezas falsas para probar el módulo de notificaciones sin base de datos ni proveedores reales.
class RepoFalso {
  constructor(turnos) { this.turnos = turnos; this.filas = []; this.seq = 1; }
  async turnoCompleto(id) { return this.turnos[id] || null; }
  async reservar(d) {
    const x = this.filas.find(f => f.idTurno === d.idTurno && f.canal === d.canal && f.clave === d.clave);
    if (x) return { id: x.id, nueva: false, estado: x.estado, intentos: x.intentos, minutos: x.minutos || 0 };
    const f = { id: this.seq++, ...d, estado: 'pendiente', intentos: 0, error: null };
    this.filas.push(f); return { id: f.id, nueva: true, estado: 'pendiente', intentos: 0, minutos: 0 };
  }
  async marcar(id, estado, o = {}) { const f = this.filas.find(x => x.id === id); Object.assign(f, { estado, error: o.error ?? null, intentos: o.intentos ?? f.intentos }); }
  async turnosEntre(desde, hasta) {
    return Object.values(this.turnos).filter(t => t.estado === 'confirmado' && `${t.fecha} ${t.hora}:00` > desde && `${t.fecha} ${t.hora}:00` <= hasta).map(t => ({ id: t.id }));
  }
  async pendientesDeReintento(max) {
    return this.filas.filter(f => ['pendiente', 'error'].includes(f.estado) && f.intentos < max).map(f => ({ id: f.id, id_turno: f.idTurno, tipo: f.tipo, clave: f.clave, canal: f.canal, intentos: f.intentos }));
  }
  async listar(id) { return this.filas.filter(f => f.idTurno === id); }
  async resumen() { return this.filas; }
  fila(canal, tipoClave) { return this.filas.find(f => f.canal === canal && (!tipoClave || f.clave.startsWith(tipoClave))); }
}

// Un canal falso: guarda lo "enviado" y puede configurarse para fallar.
function canalFalso({ configurado = true, falla = null, horario = null, prueba = false, dato = 'dato' } = {}) {
  const c = {
    etiqueta: 'falso', dato, enviados: [], falla,
    configurado: () => configurado,
    destino: p => p[c.campo], campo: 'email', mascara: x => '***' + String(x).slice(-3),
    contenido: (t, d) => ({ asunto: 'a', html: 'h', texto: `${t}:${d.fecha} ${d.hora}` }),
    async enviar(dest, cont) { if (c.falla) throw c.falla; c.enviados.push({ dest, cont }); return { id: 'id' + c.enviados.length, prueba }; }
  };
  if (horario) c.horario = horario;
  return c;
}

const turnoBase = (extra = {}) => ({
  id: 1, fecha: '2026-11-23', hora: '10:30', estado: 'confirmado', medico: 'Dra. María González', especialidad: 'Clínica Médica',
  paciente: { id: 9, nombre: 'Juan', apellido: 'Pérez', email: 'juan@correo.com', telefono: '2994123456' }, ...extra
});
const silencio = { error() {}, log() {} };
const error = (reint, msg = 'falló') => Object.assign(new Error(msg), { reintentable: reint });

module.exports = { RepoFalso, canalFalso, turnoBase, silencio, error };
