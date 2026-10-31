import { repositorio } from '../data/repositorio.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el } from '../utilidades/dom.js';

iniciarCabecera();
const [especialidades, especialistas] = await Promise.all([repositorio.listar('especialidades'), repositorio.listar('especialistas')]);
const lista = $('#lista-especialidades');
especialidades.forEach((esp) => {
  const cantidad = especialistas.filter((e) => e.especialidadId === esp.id).length;
  const item = el('li', 'tarjeta');
  item.append(el('h3', '', esp.nombre), el('p', 'texto-suave', `${cantidad} ${cantidad === 1 ? 'profesional' : 'profesionales'}`));
  lista.append(item);
});
