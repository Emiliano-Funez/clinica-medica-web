import { CONFIG } from '../config.js';
import { crearSemilla } from './seed.js';

/* Contrato único de acceso a datos. Toda la app usa SOLO estos 4 métodos (todos async):
   listar(entidad, filtro) · obtener(entidad, id) · crear(entidad, datos) · actualizar(entidad, id, cambios)
   Para conectar la base de datos: se implementa la API REST y se cambia CONFIG.adaptador a 'api'.
   Las páginas y servicios no se modifican. */

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
  async _pedir(ruta, opciones = {}) {
    const respuesta = await fetch(`${CONFIG.apiUrl}/${ruta}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...opciones });
    if (!respuesta.ok) throw new Error(`Error del servidor (${respuesta.status}).`);
    return respuesta.json();
  },
  listar(entidad, filtro = {}) { return this._pedir(`${entidad}?${new URLSearchParams(filtro)}`); },
  obtener(entidad, id) { return this._pedir(`${entidad}/${id}`); },
  crear(entidad, datos) { return this._pedir(entidad, { method: 'POST', body: JSON.stringify(datos) }); },
  actualizar(entidad, id, cambios) { return this._pedir(`${entidad}/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }); },
};

export const repositorio = CONFIG.adaptador === 'api' ? adaptadorApi : adaptadorLocal;
