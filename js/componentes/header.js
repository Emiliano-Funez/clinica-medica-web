import { RAIZ } from '../config.js';
import { usuarioActual, cerrarSesion } from '../servicios/auth.js';
import { el } from '../utilidades/dom.js';

// Solo secciones ya desarrolladas. Cada pantalla nueva se agrega aquí.
const SECCIONES = {
  paciente: [
    { texto: 'Mi panel', ruta: 'pages/panel-paciente.html' }, { texto: 'Sacar turno', ruta: 'pages/sacar-turno.html' },
    { texto: 'Mis turnos', ruta: 'pages/mis-turnos.html' }, { texto: 'Historial', ruta: 'pages/historial.html' },
    { texto: 'Mi perfil', ruta: 'pages/perfil.html' }, { texto: 'Dónde nos encontramos', ruta: 'pages/ubicacion.html' },
  ],
  especialista: [{ texto: 'Mi agenda', ruta: 'pages/agenda.html' }],
  recepcion: [
    { texto: 'Turnos del día', ruta: 'pages/turnos-dia.html' }, { texto: 'Cargar turno', ruta: 'pages/cargar-turno.html' },
    { texto: 'Nuevo paciente', ruta: 'pages/nuevo-paciente.html' },
  ],
};

function crearEnlace(texto, ruta, clase = 'enlace-nav') {
  const enlace = el('a', clase, texto);
  enlace.href = RAIZ + ruta;
  if (enlace.href === location.href) enlace.setAttribute('aria-current', 'page');
  return enlace;
}

export async function iniciarCabecera() {
  const usuario = await usuarioActual();
  const nav = el('nav', 'cabecera__nav');
  nav.setAttribute('aria-label', 'Principal');
  if (usuario) {
    (SECCIONES[usuario.rol] ?? []).forEach((s) => nav.append(crearEnlace(s.texto, s.ruta)));
    const salir = el('button', 'boton boton--secundario', 'Salir');
    salir.type = 'button';
    salir.addEventListener('click', cerrarSesion);
    nav.append(salir);
  } else {
    nav.append(
      crearEnlace('Ingresar', 'pages/ingreso.html'),
      crearEnlace('Registrarme', 'pages/registro.html', 'boton boton--primario'),
    );
  }
  const interior = el('div', 'contenedor cabecera__interior');
  interior.append(crearEnlace('ClinicaMed', 'index.html', 'logo'), nav);
  document.querySelector('.cabecera').replaceChildren(interior);
}
