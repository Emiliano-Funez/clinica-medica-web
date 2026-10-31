import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto, describir } from '../servicios/turnos.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, formatearFecha, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('especialista');
if (usuario) {
  const [doc] = await repositorio.listar('especialistas', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  const turnos = (await repositorio.listar('turnos', { especialistaId: doc.id, fecha: hoyISO() }))
    .filter((t) => t.estado !== 'cancelado').sort((a, b) => a.hora.localeCompare(b.hora));
  const atendidos = turnos.filter((t) => t.estado === 'atendido').length;
  $('#fecha-hoy').textContent = formatearFecha(hoyISO());
  $('#total').textContent = turnos.length;
  $('#atendidos').textContent = atendidos;
  $('#pendientes').textContent = turnos.length - atendidos;
  $('#vacio').hidden = turnos.length > 0;
  $('#tabla').hidden = turnos.length === 0;
  turnos.forEach((t) => {
    const d = describir(ctx, t);
    const fila = el('tr');
    fila.append(el('td', '', t.hora), el('td', '', d.pac), el('td', '', d.dni));
    const estado = el('td');
    estado.append(el('span', `insignia insignia--${t.estado}`, t.estado));
    const accion = el('td');
    const enlace = el('a', 'boton boton--secundario', t.estado === 'atendido' ? 'Ver' : 'Atender');
    enlace.href = `atencion.html?turno=${encodeURIComponent(t.id)}`;
    accion.append(enlace);
    fila.append(estado, accion);
    $('#cuerpo').append(fila);
  });
}
