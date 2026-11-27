import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto, describir, cambiarEstado } from '../servicios/turnos.js';
import { reprogramar } from '../componentes/reprogramar.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, confirmar, hoyISO, formatearFecha } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('recepcion');
if (usuario) iniciar();

async function iniciar() {
  const ctx = await cargarContexto();
  const filtros = { fecha: $('#f-fecha'), doc: $('#f-especialista'), esp: $('#f-especialidad') };
  let modo = 'fecha';
  filtros.fecha.value = hoyISO();
  ctx.especialistas.forEach((d) => filtros.doc.append(new Option(`${d.nombre} ${d.apellido}`, d.id)));
  ctx.especialidades.forEach((e) => filtros.esp.append(new Option(e.nombre, e.id)));

  async function pintar() {
    const fechaHoy = hoyISO();
    const todos = await repositorio.listar('turnos');
    const turnos = todos
      .filter((t) => modo === 'proximos'
        ? t.fecha >= fechaHoy && ['pendiente', 'confirmado'].includes(String(t.estado).toLowerCase())
        : t.fecha === filtros.fecha.value)
      .filter((t) => !filtros.doc.value || String(t.especialistaId) === String(filtros.doc.value))
      .filter((t) => {
        if (!filtros.esp.value) return true;
        const especialista = ctx.especialistas.find((d) => String(d.id) === String(t.especialistaId));
        return String(especialista?.especialidadId) === String(filtros.esp.value);
      })
      .sort((a, b) => modo === 'proximos'
        ? a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
        : a.hora.localeCompare(b.hora));

    $('#modo-info').textContent = modo === 'proximos'
      ? 'Próximos turnos pendientes y confirmados, ordenados por fecha y hora.'
      : `Turnos del ${formatearFecha(filtros.fecha.value)}.`;
    $('#ver-proximos').setAttribute('aria-pressed', String(modo === 'proximos'));
    $('#cuerpo').replaceChildren();
    $('#vacio').hidden = turnos.length > 0;
    $('#tabla').hidden = turnos.length === 0;
    $('#vacio').textContent = modo === 'proximos'
      ? 'No hay turnos próximos pendientes o confirmados con estos filtros.'
      : 'No hay turnos con estos filtros.';

    turnos.forEach((t) => {
      const d = describir(ctx, t);
      const fila = el('tr');
      fila.append(el('td', '', formatearFecha(t.fecha)), el('td', '', t.hora), el('td', '', d.pac), el('td', '', d.doc), el('td', '', d.esp));
      const estado = el('td');
      estado.append(el('span', `insignia insignia--${t.estado}`, t.estado));
      const acciones = el('td', 'turno__acciones');
      const crear = (texto, clase, accion) => { const b = el('button', `boton ${clase}`, texto); b.type = 'button'; b.addEventListener('click', accion); acciones.append(b); };
      if (t.estado === 'pendiente') crear('Confirmar', 'boton--primario', async () => { await cambiarEstado(t.id, 'confirmado'); pintar(); });
      if (['pendiente', 'confirmado'].includes(t.estado)) {
        crear('Reprogramar', 'boton--secundario', async () => { if (await reprogramar(t, 'confirmado')) pintar(); });
        crear('Cancelar', 'boton--peligro', async () => { if (await confirmar('¿Cancelar este turno?')) { await cambiarEstado(t.id, 'cancelado'); pintar(); } });
      }
      fila.append(estado, acciones);
      $('#cuerpo').append(fila);
    });
  }
  filtros.fecha.addEventListener('change', () => { modo = 'fecha'; pintar(); });
  [filtros.doc, filtros.esp].forEach((campo) => campo.addEventListener('change', pintar));
  $('#ver-proximos').addEventListener('click', () => { modo = 'proximos'; pintar(); });
  pintar();
}
