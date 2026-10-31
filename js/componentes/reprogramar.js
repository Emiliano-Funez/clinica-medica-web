import { cambiarHorario } from '../servicios/turnos.js';
import { montarSelector } from './selector-turno.js';
import { el, mostrarAviso } from '../utilidades/dom.js';

// Abre un modal para elegir nuevo horario con el mismo profesional. Resuelve true si se reprogramó.
export function reprogramar(turno, estadoNuevo) {
  return new Promise((resolver) => {
    const dialogo = el('dialog', 'modal modal--ancho');
    const contenedor = el('div');
    const aviso = el('p');
    aviso.hidden = true;
    aviso.setAttribute('role', 'alert');
    const ok = el('button', 'boton boton--primario', 'Confirmar nuevo horario');
    const no = el('button', 'boton boton--secundario', 'Volver');
    [ok, no].forEach((b) => { b.type = 'button'; });
    ok.disabled = true;
    let eleccion = {};
    const cerrar = (valor) => { dialogo.close(); dialogo.remove(); resolver(valor); };
    montarSelector(contenedor, { especialistaId: turno.especialistaId, alCambiar: (s) => { eleccion = s; ok.disabled = !s.hora; } });
    ok.addEventListener('click', async () => {
      try { await cambiarHorario(turno, eleccion, estadoNuevo); cerrar(true); } catch (error) { mostrarAviso(aviso, error.message); }
    });
    no.addEventListener('click', () => cerrar(false));
    dialogo.addEventListener('cancel', () => cerrar(false));
    const acciones = el('div', 'modal__acciones');
    acciones.append(ok, no);
    dialogo.append(el('h2', '', 'Reprogramar turno'), contenedor, aviso, acciones);
    document.body.append(dialogo);
    dialogo.showModal();
  });
}
