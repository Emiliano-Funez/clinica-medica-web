import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto, describir, cambiarEstado } from '../servicios/turnos.js';
import { reprogramar } from '../componentes/reprogramar.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, confirmar, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('recepcion');
if (usuario) iniciar();

async function iniciar() {
  const ctx = await cargarContexto();
  const filtros = { fecha: $('#f-fecha'), doc: $('#f-especialista'), esp: $('#f-especialidad') };
  filtros.fecha.value = hoyISO();
  ctx.especialistas.forEach((d) => filtros.doc.append(new Option(`${d.nombre} ${d.apellido}`, d.id)));
  ctx.especialidades.forEach((e) => filtros.esp.append(new Option(e.nombre, e.id)));

  async function pintar() {
    const turnos = (await repositorio.listar('turnos', { fecha: filtros.fecha.value }))
      .filter((t) => !filtros.doc.value || t.especialistaId === filtros.doc.value)
      .filter((t) => !filtros.esp.value || ctx.especialistas.find((d) => d.id === t.especialistaId).especialidadId === filtros.esp.value)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    $('#cuerpo').replaceChildren();
    $('#vacio').hidden = turnos.length > 0;
    $('#tabla').hidden = turnos.length === 0;
    turnos.forEach((t) => {
      const d = describir(ctx, t);
      const fila = el('tr');
      fila.append(el('td', '', t.hora), el('td', '', d.pac), el('td', '', d.doc), el('td', '', d.esp));
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
  Object.values(filtros).forEach((campo) => campo.addEventListener('change', pintar));
  pintar();
}
