import { CONFIG } from '../config.js';
import { crearSemilla } from './seed.js';

export const API_TOKEN = 'clinicamed.apiToken';

export async function apiPedir(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = sessionStorage.getItem(API_TOKEN);
  if (token) headers.Authorization = `Bearer ${token}`;
  let respuesta;
  try {
    respuesta = await fetch(`${CONFIG.apiUrl}/${ruta}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté iniciado.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || `Error del servidor (${respuesta.status}).`);
  return datos;
}

/* Contrato único de acceso a datos. Las pantallas siguen usando estos métodos; el adaptador API
   los traduce a las rutas del backend y mantiene las mismas entidades que el modo local. */

const CLAVE = 'clinicamed.demo.v2';

const adaptadorLocal = {
  async _leer() {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return JSON.parse(guardado);
    const semilla = await crearSemilla();
    this._guardar(semilla);
    return semilla;
  },
  _guardar(db) { localStorage.setItem(CLAVE, JSON.stringify(db)); },
  async listar(entidad, filtro = {}) {
    const db = await this._leer();
    return db[entidad].filter((fila) => Object.entries(filtro).every(([campo, valor]) => fila[campo] === valor));
  },
  async obtener(entidad, id) { return (await this.listar(entidad, { id }))[0] ?? null; },
  async crear(entidad, datos) {
    const db = await this._leer();
    const fila = { id: `${entidad.slice(0, 3)}-${crypto.randomUUID().slice(0, 8)}`, ...datos };
    db[entidad].push(fila);
    this._guardar(db);
    return fila;
  },
  async actualizar(entidad, id, cambios) {
    const db = await this._leer();
    const fila = db[entidad].find((f) => f.id === id);
    if (!fila) throw new Error('Registro no encontrado.');
    Object.assign(fila, cambios);
    this._guardar(db);
    return fila;
  },
};

const adaptadorApi = {
  async listar(entidad, filtro = {}) {
    const publico = entidad === 'especialidades' || entidad === 'especialistas';
    const datos = await apiPedir(publico ? 'catalogos' : 'datos');
    const filas = datos[entidad] || [];
    return filas.filter(fila => Object.entries(filtro).every(([campo, valor]) => String(fila[campo]) === String(valor)));
  },
  async obtener(entidad, id) {
    return (await this.listar(entidad)).find(fila => String(fila.id) === String(id)) ?? null;
  },
  async crear(entidad, datos) {
    if (entidad === 'pacientes') {
      const r = await apiPedir('pacientes', { method: 'POST', body: datos });
      return { id: r.id, ...datos, usuarioId: r.usuarioId ?? null };
    }
    if (entidad === 'turnos') {
      const r = await apiPedir('turnos', { method: 'POST', body: {
        pac: datos.pacienteId, esp: datos.especialistaId, fecha: datos.fecha, hora: datos.hora, estado: datos.estado,
      } });
      return { ...datos, id: r.id, pacienteId: r.pacienteId, especialistaId: r.especialistaId, estado: r.estado };
    }
    if (entidad === 'historial') {
      const r = await apiPedir('historial', { method: 'POST', body: {
        turno: datos.turnoId, fecha: datos.fecha, motivo: datos.motivo, resultado: datos.resultado,
      } });
      return { ...datos, id: r.id };
    }
    throw new Error(`No se puede crear ${entidad} desde esta pantalla.`);
  },
  async actualizar(entidad, id, cambios) {
    if (entidad === 'pacientes') {
      await apiPedir(`pacientes/${id}`, { method: 'PATCH', body: cambios });
      return { id, ...cambios };
    }
    if (entidad === 'turnos') {
      const reprograma = cambios.fecha !== undefined || cambios.hora !== undefined;
      const ruta = reprograma ? `turnos/${id}/reprogramar` : `turnos/${id}`;
      await apiPedir(ruta, { method: 'PATCH', body: reprograma ? cambios : { estado: cambios.estado } });
      return { id, ...cambios };
    }
    throw new Error(`No se puede actualizar ${entidad} desde esta pantalla.`);
  },
};

export const repositorio = CONFIG.adaptador === 'api' ? adaptadorApi : adaptadorLocal;
