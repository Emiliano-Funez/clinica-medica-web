import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { buscarPorDni } from '../servicios/pacientes.js';
import { crearTurno, cargarContexto } from '../servicios/turnos.js';
import { montarSelector } from '../componentes/selector-turno.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, mostrarAviso, formatearFecha } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('recepcion');
if (usuario) iniciar();

async function iniciar() {
  const ctx = await cargarContexto();
  let paciente = null;
  let eleccion = {};
  ctx.especialidades.forEach((e) => $('#especialidad').append(new Option(e.nombre, e.id)));

  const actualizarConfirmar = () => { $('#confirmar').disabled = !(paciente && eleccion.hora); };
  const cargarSelector = () => montarSelector($('#selector'), {
    especialidadId: $('#especialidad').value,
    alCambiar: (s) => {
      eleccion = s;
      const doc = ctx.especialistas.find((d) => d.id === s.especialistaId);
      $('#resumen').textContent = s.hora ? `Dr/a. ${doc.nombre} ${doc.apellido} · ${formatearFecha(s.fecha)} · ${s.hora} hs` : 'Elegí un horario.';
      actualizarConfirmar();
    },
  });

  async function buscar() {
    paciente = await buscarPorDni($('#dni').value);
    $('#no-registrado').hidden = !!paciente;
    $('#paciente').textContent = paciente ? `${paciente.apellido}, ${paciente.nombre} · DNI ${paciente.dni}` : '';
    $('#paso-turno').hidden = !paciente;
    if (paciente) cargarSelector();
    actualizarConfirmar();
  }

  $('#form-busqueda').addEventListener('submit', (evento) => { evento.preventDefault(); if ($('#form-busqueda').reportValidity()) buscar(); });
  $('#especialidad').addEventListener('change', cargarSelector);
  $('#confirmar').addEventListener('click', async () => {
    try {
      await crearTurno({ pacienteId: paciente.id, especialistaId: eleccion.especialistaId, fecha: eleccion.fecha, hora: eleccion.hora, estado: 'confirmado' });
      mostrarAviso($('#aviso'), 'Turno confirmado.', 'ok');
      $('#paso-turno').hidden = true;
      $('#form-busqueda').reset();
      paciente = null;
    } catch (error) { mostrarAviso($('#aviso'), error.message); cargarSelector(); }
  });

  const dni = new URLSearchParams(location.search).get('dni');
  if (dni) { $('#dni').value = dni; buscar(); }
}
