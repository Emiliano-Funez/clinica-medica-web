import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, formatearFecha, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');

// Accesos de las próximas pantallas (05, 08 y 09). Se activan cuando existan.
const ACCESOS = [
  { titulo: 'Sacar turno', detalle: 'Elegí especialidad, profesional y horario.' },
  { titulo: 'Mis turnos', detalle: 'Reprogramá o cancelá tus turnos.' },
  { titulo: 'Historial clínico', detalle: 'Consultá tus visitas anteriores.' },
];

if (usuario) {
  const [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const [turnos, especialistas, especialidades] = await Promise.all([
    repositorio.listar('turnos', { pacienteId: paciente.id }),
    repositorio.listar('especialistas'),
    repositorio.listar('especialidades'),
  ]);

  $('#saludo').textContent = `Hola, ${paciente.nombre}`;
  $('#fecha-hoy').textContent = formatearFecha(hoyISO());

  ACCESOS.forEach((acceso) => {
    const tarjeta = el('div', 'tarjeta tarjeta--deshabilitada');
    tarjeta.setAttribute('aria-disabled', 'true');
    tarjeta.append(el('h3', '', acceso.titulo), el('p', 'texto-suave', acceso.detalle), el('span', 'insignia insignia--atendido', 'Próximamente'));
    $('#accesos').append(tarjeta);
  });

  const hoy = hoyISO();
  const proximos = turnos
    .filter((t) => t.fecha >= hoy && t.estado !== 'cancelado')
    .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));

  $('#sin-turnos').hidden = proximos.length > 0;
  proximos.forEach((turno) => {
    const doc = especialistas.find((e) => e.id === turno.especialistaId);
    const esp = especialidades.find((e) => e.id === doc.especialidadId);
    const item = el('li', 'tarjeta turno');
    const datos = el('div');
    datos.append(el('strong', '', `${formatearFecha(turno.fecha)} · ${turno.hora} hs`), el('p', 'texto-suave', `Dr/a. ${doc.nombre} ${doc.apellido} · ${esp.nombre}`));
    item.append(datos, el('span', `insignia insignia--${turno.estado}`, turno.estado));
    $('#lista-turnos').append(item);
  });
}
