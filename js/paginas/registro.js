import { RAIZ } from '../config.js';
import { registrarPaciente, RUTAS_POR_ROL } from '../servicios/auth.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, mostrarAviso, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const formulario = $('#form-registro');
const aviso = $('#aviso');
formulario.fechaNacimiento.max = hoyISO();

const verificarClaves = () =>
  formulario.clave2.setCustomValidity(formulario.clave.value === formulario.clave2.value ? '' : 'Las contraseñas no coinciden.');
formulario.clave.addEventListener('input', verificarClaves);
formulario.clave2.addEventListener('input', verificarClaves);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarAviso(aviso, '');
  verificarClaves();
  if (!formulario.reportValidity()) return;
  const boton = $('button[type="submit"]', formulario);
  boton.disabled = true;
  try {
    const usuario = await registrarPaciente(Object.fromEntries(new FormData(formulario)));
    location.href = RAIZ + RUTAS_POR_ROL[usuario.rol];
  } catch (error) {
    mostrarAviso(aviso, error.message);
    boton.disabled = false;
  }
});
