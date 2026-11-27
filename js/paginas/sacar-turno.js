import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { crearTurno, cargarContexto, describir } from '../servicios/turnos.js';
import { montarSelector } from '../componentes/selector-turno.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, mostrarAviso, formatearFecha } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');
if (usuario) iniciar(usuario);

async function iniciar(usuario) {
  const [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  let especialidadId = null;
  let eleccion = {};

  const irAPaso = (n) => [1, 2, 3].forEach((i) => {
    $(`#paso-${i}`).hidden = i !== n;
    $(`#ind-${i}`).toggleAttribute('aria-current', i === n);
  });

  ctx.especialidades.forEach((esp) => {
    const cantidad = ctx.especialistas.filter((d) => d.especialidadId === esp.id).length;
    const boton = el('button', 'tarjeta tarjeta--enlace');
    boton.type = 'button';
    boton.setAttribute('aria-pressed', 'false');
    boton.append(el('h3', '', esp.nombre), el('p', 'texto-suave', `${cantidad} profesional${cantidad === 1 ? '' : 'es'}`));
    boton.addEventListener('click', () => {
      especialidadId = esp.id;
      $('#especialidades').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
      $('#continuar').disabled = false;
    });
    $('#especialidades').append(boton);
  });

  const cargarSelector = () => montarSelector($('#selector'), {
    especialidadId,
    pacienteId: paciente.id,
    alCambiar: (s) => {
      eleccion = s;
      const doc = ctx.especialistas.find((d) => d.id === s.especialistaId);
      $('#resumen').textContent = s.hora ? `Dr/a. ${doc.nombre} ${doc.apellido} · ${formatearFecha(s.fecha)} · ${s.hora} hs` : 'Elegí un horario.';
      $('#confirmar').disabled = !s.hora;
    },
  });

  $('#continuar').addEventListener('click', () => { irAPaso(2); cargarSelector(); });
  $('#volver').addEventListener('click', () => irAPaso(1));
  $('#confirmar').addEventListener('click', async () => {
    mostrarAviso($('#aviso'), '');
    try {
      const turno = await crearTurno({ pacienteId: paciente.id, especialistaId: eleccion.especialistaId, fecha: eleccion.fecha, hora: eleccion.hora, estado: 'pendiente' });
      const d = describir(ctx, turno);
      $('#datos-turno').textContent = `Dr/a. ${d.doc} (${d.esp}) · ${formatearFecha(turno.fecha)} · ${turno.hora} hs · Estado: pendiente de confirmación por recepción.`;
      irAPaso(3);
    } catch (error) {
      mostrarAviso($('#aviso'), error.message);
      cargarSelector();
    }
  });
}
