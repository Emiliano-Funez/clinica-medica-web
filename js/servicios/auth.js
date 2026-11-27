import { RAIZ, CONFIG } from '../config.js';
import { apiPedir, API_TOKEN, repositorio } from '../data/repositorio.js';
import { hashClave } from '../utilidades/seguridad.js';

// La sesión API se guarda en sessionStorage y el backend valida un token JWT por petición.
const SESION = 'clinicamed.sesion';
// Pantallas de inicio por rol. Se completa a medida que se desarrolla cada panel.
export const RUTAS_POR_ROL = { paciente: 'pages/panel-paciente.html', especialista: 'pages/agenda.html', recepcion: 'pages/turnos-dia.html' };

export async function ingresar(email, clave) {
  if (CONFIG.adaptador === 'api') {
    const r = await apiPedir('login', { method: 'POST', body: { email: email.trim().toLowerCase(), password: clave } });
    sessionStorage.setItem(API_TOKEN, r.token);
    sessionStorage.setItem(SESION, String(r.user.id));
    return r.user;
  }
  const [usuario] = await repositorio.listar('usuarios', { email: email.trim().toLowerCase() });
  if (!usuario || usuario.passwordHash !== (await hashClave(clave))) throw new Error('Email o contraseña incorrectos.');
  if (!RUTAS_POR_ROL[usuario.rol]) throw new Error('El panel de este rol todavía no está disponible.');
  sessionStorage.setItem(SESION, usuario.id);
  return usuario;
}

export async function registrarPaciente(datos) {
  if (CONFIG.adaptador === 'api') {
    const r = await apiPedir('registro', { method: 'POST', body: {
      nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), dni: datos.dni.trim(),
      fecha_nacimiento: datos.fechaNacimiento, email: datos.email.trim().toLowerCase(),
      telefono: datos.telefono.trim(), password: datos.clave,
    } });
    sessionStorage.setItem(API_TOKEN, r.token);
    sessionStorage.setItem(SESION, String(r.user.id));
    return r.user;
  }
  const email = datos.email.trim().toLowerCase();
  if ((await repositorio.listar('usuarios', { email })).length) throw new Error('Ya existe una cuenta con ese email. Usá otro.');
  if ((await repositorio.listar('pacientes', { dni: datos.dni })).length) throw new Error('Ya hay un paciente registrado con ese DNI.');
  const usuario = await repositorio.crear('usuarios', { rol: 'paciente', email, passwordHash: await hashClave(datos.clave) });
  await repositorio.crear('pacientes', {
    usuarioId: usuario.id, nombre: datos.nombre.trim(), apellido: datos.apellido.trim(),
    dni: datos.dni, fechaNacimiento: datos.fechaNacimiento, telefono: datos.telefono.trim(),
  });
  sessionStorage.setItem(SESION, usuario.id);
  return usuario;
}

export async function usuarioActual() {
  if (CONFIG.adaptador === 'api') {
    if (!sessionStorage.getItem(API_TOKEN)) return null;
    try {
      const r = await apiPedir('yo');
      sessionStorage.setItem(SESION, String(r.user.id));
      return r.user;
    } catch {
      sessionStorage.removeItem(API_TOKEN);
      sessionStorage.removeItem(SESION);
      return null;
    }
  }
  const id = sessionStorage.getItem(SESION);
  return id ? repositorio.obtener('usuarios', id) : null;
}

export async function exigirRol(rol) {
  const usuario = await usuarioActual();
  if (usuario?.rol === rol) return usuario;
  location.replace(`${RAIZ}pages/ingreso.html`);
  return null;
}

export function cerrarSesion() {
  sessionStorage.removeItem(SESION);
  sessionStorage.removeItem(API_TOKEN);
  location.href = `${RAIZ}index.html`;
}

export async function cambiarClave(usuario, actual, nueva) {
  if (CONFIG.adaptador === 'api') throw new Error('El cambio de contraseña todavía no está disponible.');
  if (usuario.passwordHash !== (await hashClave(actual))) throw new Error('La contraseña actual no es correcta.');
  await repositorio.actualizar('usuarios', usuario.id, { passwordHash: await hashClave(nueva) });
}
