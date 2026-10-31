import { RAIZ } from '../config.js';
import { ingresar, RUTAS_POR_ROL } from '../servicios/auth.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, mostrarAviso } from '../utilidades/dom.js';

iniciarCabecera();
const formulario = $('#form-ingreso');
const aviso = $('#aviso');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarAviso(aviso, '');
  if (!formulario.reportValidity()) return;
  const boton = $('button[type="submit"]', formulario);
  boton.disabled = true;
  try {
    const usuario = await ingresar(formulario.email.value, formulario.clave.value);
    location.href = RAIZ + RUTAS_POR_ROL[usuario.rol];
  } catch (error) {
    mostrarAviso(aviso, error.message);
    boton.disabled = false;
  }
});
