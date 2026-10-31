import { repositorio } from '../data/repositorio.js';
import { horariosLibres, proximosDias } from '../servicios/turnos.js';
import { el, formatearFecha } from '../utilidades/dom.js';

// Elige fecha, profesional y horario libre. Se usa al sacar turno, cargar turno y reprogramar.
export async function montarSelector(raiz, { especialidadId, especialistaId, alCambiar }) {
  const profesionales = (await repositorio.listar('especialistas')).filter((d) => (especialistaId ? d.id === especialistaId : d.especialidadId === especialidadId));
  const seleccion = { fecha: null, especialistaId: especialistaId ?? null, hora: null };
  const fechas = el('div', 'selector__fechas');
  const lista = el('div', 'selector__lista');
  raiz.replaceChildren(fechas, lista);
  const avisar = () => alCambiar?.({ ...seleccion });

  async function pintarProfesionales() {
    lista.replaceChildren();
    for (const doc of profesionales) {
      const libres = await horariosLibres(doc.id, seleccion.fecha);
      const tarjeta = el('div', 'tarjeta');
      tarjeta.append(el('h3', '', `Dr/a. ${doc.nombre} ${doc.apellido}`));
      if (!libres.length) tarjeta.append(el('p', 'texto-suave', 'Sin horarios libres este día. Probá otra fecha o profesional.'));
      const horas = el('div', 'selector__horas');
      libres.forEach((hora) => {
        const boton = el('button', 'boton boton--hora', hora);
        boton.type = 'button';
        boton.setAttribute('aria-pressed', String(seleccion.hora === hora && seleccion.especialistaId === doc.id));
        boton.addEventListener('click', () => { Object.assign(seleccion, { especialistaId: doc.id, hora }); pintarProfesionales(); avisar(); });
        horas.append(boton);
      });
      tarjeta.append(horas);
      lista.append(tarjeta);
    }
  }

  proximosDias().forEach((fecha) => {
    const boton = el('button', 'boton', formatearFecha(fecha));
    boton.type = 'button';
    boton.addEventListener('click', () => {
      Object.assign(seleccion, { fecha, hora: null, especialistaId: especialistaId ?? null });
      fechas.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
      pintarProfesionales();
      avisar();
    });
    fechas.append(boton);
  });
  fechas.firstChild.click();
}
