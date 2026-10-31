import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cambiarEstado } from '../servicios/turnos.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, mostrarAviso, formatearFecha, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('especialista');
if (usuario) iniciar(usuario);

async function iniciar(usuario) {
  const [doc] = await repositorio.listar('especialistas', { usuarioId: usuario.id });
  const turno = await repositorio.obtener('turnos', new URLSearchParams(location.search).get('turno') ?? '');
  if (!turno || turno.especialistaId !== doc.id) { $('#contenido').replaceChildren(el('p', 'aviso aviso--error', 'Turno no encontrado.')); return; }
  const paciente = await repositorio.obtener('pacientes', turno.pacienteId);
  $('#paciente').textContent = `${paciente.apellido}, ${paciente.nombre}`;
  $('#datos').textContent = `DNI ${paciente.dni} · Tel. ${paciente.telefono}`;

  const previas = (await repositorio.listar('historial', { pacienteId: paciente.id })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  $('#sin-previas').hidden = previas.length > 0;
  previas.forEach((v) => {
    const tarjeta = el('li', 'tarjeta');
    tarjeta.append(el('strong', '', formatearFecha(v.fecha)), el('p', '', v.motivo), el('p', 'texto-suave', v.resultado));
    $('#previas').append(tarjeta);
  });

  const f = $('#form-historial');
  if (turno.estado === 'atendido') { f.hidden = true; $('#ya-atendido').hidden = false; return; }
  f.fecha.value = hoyISO();
  f.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const faltan = ['motivo', 'resultado'].filter((c) => !f[c].value.trim());
    if (faltan.length || !f.fecha.value) { mostrarAviso($('#aviso'), `Completá los campos que faltan: ${faltan.length ? faltan.join(' y ') : 'fecha'}.`); return; }
    await repositorio.crear('historial', { pacienteId: paciente.id, especialistaId: doc.id, turnoId: turno.id, fecha: f.fecha.value, motivo: f.motivo.value.trim(), resultado: f.resultado.value.trim() });
    await cambiarEstado(turno.id, 'atendido');
    location.href = 'agenda.html';
  });
}
