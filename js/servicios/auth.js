import { RAIZ } from '../config.js';
import { repositorio } from '../data/repositorio.js';
import { hashClave } from '../utilidades/seguridad.js';

// SOLO DEMO: con backend, la sesión será una cookie httpOnly emitida por el servidor.
const SESION = 'clinicamed.sesion';
// Pantallas de inicio por rol. Se completa a medida que se desarrolla cada panel.
export const RUTAS_POR_ROL = { paciente: 'pages/panel-paciente.html' };

export async function ingresar(email, clave) {
  const [usuario] = await repositorio.listar('usuarios', { email: email.trim().toLowerCase() });
  if (!usuario || usuario.passwordHash !== (await hashClave(clave))) throw new Error('Email o contraseña incorrectos.');
  if (!RUTAS_POR_ROL[usuario.rol]) throw new Error('El panel de este rol todavía no está disponible.');
  sessionStorage.setItem(SESION, usuario.id);
  return usuario;
}

export async function registrarPaciente(datos) {
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
  location.href = `${RAIZ}index.html`;
}
