import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto } from '../servicios/turnos.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, formatearFecha } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');
if (usuario) iniciar();

async function iniciar() {
  const [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  const visitas = (await repositorio.listar('historial', { pacienteId: paciente.id }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filtro = $('#f-especialidad');
  const especialidadesConVisitas = new Map();

  visitas.forEach((v) => {
    const doc = ctx.especialistas.find((d) => String(d.id) === String(v.especialistaId));
    const esp = ctx.especialidades.find((e) => String(e.id) === String(doc?.especialidadId));
    if (esp) especialidadesConVisitas.set(String(esp.id), esp.nombre);
  });
  [...especialidadesConVisitas.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .forEach(([id, nombre]) => filtro.append(new Option(nombre, id)));

  function pintar() {
    const seleccion = filtro.value;
    const filtradas = visitas.filter((v) => {
      if (!seleccion) return true;
      const doc = ctx.especialistas.find((d) => String(d.id) === String(v.especialistaId));
      return String(doc?.especialidadId) === seleccion;
    });
    $('#lista').replaceChildren();
    $('#lista').hidden = filtradas.length === 0;
    $('#vacio').hidden = filtradas.length > 0;
    $('#vacio').textContent = visitas.length === 0
      ? 'Todavía no tenés visitas registradas.'
      : 'No hay visitas registradas para esta especialidad.';

    filtradas.forEach((v) => {
      const doc = ctx.especialistas.find((d) => String(d.id) === String(v.especialistaId));
      const esp = ctx.especialidades.find((e) => String(e.id) === String(doc?.especialidadId));
      const tarjeta = el('li', 'tarjeta');
      tarjeta.append(
        el('h3', '', `Dr/a. ${doc?.nombre || ''} ${doc?.apellido || ''} · ${esp?.nombre || 'Especialidad'}`),
        el('p', 'texto-suave', formatearFecha(v.fecha)),
        el('strong', '', 'Motivo de la consulta'), el('p', '', v.motivo),
        el('strong', '', 'Resultado'), el('p', '', v.resultado),
      );
      $('#lista').append(tarjeta);
    });
  }

  filtro.addEventListener('change', pintar);
  pintar();
}
