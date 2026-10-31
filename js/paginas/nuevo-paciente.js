import { exigirRol } from '../servicios/auth.js';
import { altaPaciente } from '../servicios/pacientes.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, mostrarAviso, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('recepcion');
if (usuario) {
  const f = $('#form-paciente');
  f.fechaNacimiento.max = hoyISO();
  let cargarTurno = false;
  $('#guardar-turno').addEventListener('click', () => { cargarTurno = true; });
  f.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const quiereTurno = cargarTurno;
    cargarTurno = false;
    mostrarAviso($('#aviso'), '');
    if (!f.reportValidity()) return;
    try {
      const paciente = await altaPaciente(Object.fromEntries(new FormData(f)));
      if (quiereTurno) { location.href = `cargar-turno.html?dni=${encodeURIComponent(paciente.dni)}`; return; }
      f.reset();
      mostrarAviso($('#aviso'), `Paciente ${paciente.nombre} ${paciente.apellido} guardado.`, 'ok');
    } catch (error) { mostrarAviso($('#aviso'), error.message); }
  });
}
