import { repositorio } from '../data/repositorio.js';

// Regla fija de DEMO (lunes a viernes, 09:00-13:00, turnos de 30 min).
// Con base de datos esto pasa a una tabla "disponibilidad" por especialista.
const HORARIOS = { desde: 9, hasta: 13, pasoMin: 30 };

export function franjas() {
  const horas = [];
  for (let min = HORARIOS.desde * 60; min < HORARIOS.hasta * 60; min += HORARIOS.pasoMin) {
    horas.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }
  return horas;
}

export function proximosDias(cantidad = 7) {
  const dias = [];
  const d = new Date();
  while (dias.length < cantidad) {
    if (![0, 6].includes(d.getDay())) dias.push(d.toLocaleDateString('sv-SE'));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

export async function horariosLibres(especialistaId, fecha) {
  const ocupados = (await repositorio.listar('turnos', { especialistaId, fecha })).filter((t) => t.estado !== 'cancelado').map((t) => t.hora);
  const ahora = new Date().toLocaleTimeString('sv-SE').slice(0, 5);
  const esHoy = fecha === new Date().toLocaleDateString('sv-SE');
  return franjas().filter((h) => !ocupados.includes(h) && !(esHoy && h <= ahora));
}

async function validarLibre(especialistaId, fecha, hora) {
  if (!(await horariosLibres(especialistaId, fecha)).includes(hora)) throw new Error('Ese horario ya no está disponible. Elegí otro.');
}

export async function crearTurno({ pacienteId, especialistaId, fecha, hora, estado }) {
  await validarLibre(especialistaId, fecha, hora);
  return repositorio.crear('turnos', { pacienteId, especialistaId, fecha, hora, estado });
}

export async function cambiarHorario(turno, { fecha, hora }, estado) {
  await validarLibre(turno.especialistaId, fecha, hora);
  return repositorio.actualizar('turnos', turno.id, { fecha, hora, estado });
}

export const cambiarEstado = (id, estado) => repositorio.actualizar('turnos', id, { estado });

export async function cargarContexto() {
  const [especialidades, especialistas, pacientes] = await Promise.all([
    repositorio.listar('especialidades'), repositorio.listar('especialistas'), repositorio.listar('pacientes'),
  ]);
  return { especialidades, especialistas, pacientes };
}

export function describir(ctx, turno) {
  const doc = ctx.especialistas.find((e) => e.id === turno.especialistaId);
  const esp = ctx.especialidades.find((e) => e.id === doc.especialidadId);
  const pac = ctx.pacientes.find((p) => p.id === turno.pacienteId);
  return { doc: `${doc.nombre} ${doc.apellido}`, esp: esp.nombre, pac: pac ? `${pac.apellido}, ${pac.nombre}` : '', dni: pac?.dni ?? '' };
}
