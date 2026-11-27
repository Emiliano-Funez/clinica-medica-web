import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto, describir } from '../servicios/turnos.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, formatearFecha, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('especialista');
if (usuario) iniciar();

async function iniciar() {
  const [doc] = await repositorio.listar('especialistas', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  const todosLosTurnos = (await repositorio.listar('turnos', { especialistaId: doc.id }))
    .filter((t) => t.estado !== 'cancelado');
  const fechaInput = $('#fecha-agenda');
  const hoy = hoyISO();
  let filtroEstado = 'todos';
  let modoActual = 'fecha';
  let fechaActual = hoy;
  fechaInput.value = hoy;

  function mostrarTurnos(modo, fecha = fechaInput.value) {
    modoActual = modo;
    fechaActual = fecha;
    const turnosDelModo = todosLosTurnos
      .filter((t) => modo === 'proximos' ? t.fecha >= hoy : t.fecha === fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    const atendidos = turnosDelModo.filter((t) => t.estado === 'atendido').length;
    const pendientes = turnosDelModo.length - atendidos;
    const turnos = turnosDelModo.filter((t) => {
      if (filtroEstado === 'atendidos') return t.estado === 'atendido';
      if (filtroEstado === 'pendientes') return t.estado !== 'atendido';
      return true;
    });

    $('#fecha-hoy').textContent = modo === 'proximos'
      ? `Próximos turnos desde ${formatearFecha(hoy)}`
      : `Agenda del ${formatearFecha(fecha)}`;
    $('#total').textContent = turnosDelModo.length;
    $('#atendidos').textContent = atendidos;
    $('#pendientes').textContent = pendientes;
    $('#filtro-total').setAttribute('aria-pressed', String(filtroEstado === 'todos'));
    $('#filtro-atendidos').setAttribute('aria-pressed', String(filtroEstado === 'atendidos'));
    $('#filtro-pendientes').setAttribute('aria-pressed', String(filtroEstado === 'pendientes'));

    const cuerpo = $('#cuerpo');
    cuerpo.replaceChildren();
    $('#tabla').hidden = turnos.length === 0;
    $('#vacio').hidden = turnos.length > 0;
    const periodo = modo === 'proximos' ? 'próximos' : `para el ${formatearFecha(fecha)}`;
    const tipo = filtroEstado === 'atendidos' ? 'atendidos' : filtroEstado === 'pendientes' ? 'pendientes' : 'turnos';
    $('#vacio').textContent = `No tenés ${tipo} ${periodo}.`;

    turnos.forEach((t) => {
      const d = describir(ctx, t);
      const fila = el('tr');
      fila.append(el('td', '', formatearFecha(t.fecha)), el('td', '', t.hora), el('td', '', d.pac), el('td', '', d.dni));
      const estado = el('td');
      estado.append(el('span', `insignia insignia--${t.estado}`, t.estado));
      const accion = el('td');
      const enlace = el('a', 'boton boton--secundario', t.estado === 'atendido' ? 'Ver' : 'Atender');
      enlace.href = `atencion.html?turno=${encodeURIComponent(t.id)}`;
      accion.append(enlace);
      fila.append(estado, accion);
      cuerpo.append(fila);
    });
  }

  const mostrarTodos = (modo, fecha) => {
    filtroEstado = 'todos';
    mostrarTurnos(modo, fecha);
  };
  $('#ver-fecha').addEventListener('click', () => {
    if (fechaInput.reportValidity()) mostrarTodos('fecha');
  });
  fechaInput.addEventListener('change', () => mostrarTodos('fecha'));
  $('#ver-proximos').addEventListener('click', () => mostrarTodos('proximos'));
  $('#filtro-total').addEventListener('click', () => { filtroEstado = 'todos'; mostrarTurnos(modoActual, fechaActual); });
  $('#filtro-atendidos').addEventListener('click', () => { filtroEstado = 'atendidos'; mostrarTurnos(modoActual, fechaActual); });
  $('#filtro-pendientes').addEventListener('click', () => { filtroEstado = 'pendientes'; mostrarTurnos(modoActual, fechaActual); });
  mostrarTurnos('fecha', hoy);
}
