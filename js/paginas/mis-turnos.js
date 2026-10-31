import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto, describir, cambiarEstado } from '../servicios/turnos.js';
import { reprogramar } from '../componentes/reprogramar.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, confirmar, formatearFecha, hoyISO } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');
if (usuario) iniciar(usuario);

async function iniciar(usuario) {
  const [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  let pestana = 'proximos';
  const esProximo = (t) => t.fecha >= hoyISO() && ['pendiente', 'confirmado'].includes(t.estado);

  async function pintar() {
    const sentido = pestana === 'proximos' ? 1 : -1;
    const turnos = (await repositorio.listar('turnos', { pacienteId: paciente.id }))
      .filter((t) => esProximo(t) === (pestana === 'proximos'))
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`) * sentido);
    $('#lista').replaceChildren();
    $('#vacio').hidden = turnos.length > 0;
    turnos.forEach((turno) => {
      const d = describir(ctx, turno);
      const item = el('li', 'tarjeta turno');
      const info = el('div');
      info.append(el('strong', '', `${formatearFecha(turno.fecha)} · ${turno.hora} hs`), el('p', 'texto-suave', `Dr/a. ${d.doc} · ${d.esp}`));
      item.append(info, el('span', `insignia insignia--${turno.estado}`, turno.estado));
      if (esProximo(turno)) {
        const acciones = el('div', 'turno__acciones');
        const rep = el('button', 'boton boton--secundario', 'Reprogramar');
        const can = el('button', 'boton boton--peligro', 'Cancelar');
        [rep, can].forEach((b) => { b.type = 'button'; });
        rep.addEventListener('click', async () => { if (await reprogramar(turno, 'pendiente')) pintar(); });
        can.addEventListener('click', async () => { if (await confirmar('¿Querés cancelar este turno?')) { await cambiarEstado(turno.id, 'cancelado'); pintar(); } });
        acciones.append(rep, can);
        item.append(acciones);
      }
      $('#lista').append(item);
    });
  }

  document.querySelectorAll('[data-pestana]').forEach((boton) => boton.addEventListener('click', () => {
    pestana = boton.dataset.pestana;
    document.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
    pintar();
  }));
  pintar();
}
