import { exigirRol } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { cargarContexto } from '../servicios/turnos.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, el, formatearFecha } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');
if (usuario) {
  const [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const ctx = await cargarContexto();
  const visitas = (await repositorio.listar('historial', { pacienteId: paciente.id })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  $('#vacio').hidden = visitas.length > 0;
  visitas.forEach((v) => {
    const doc = ctx.especialistas.find((d) => d.id === v.especialistaId);
    const esp = ctx.especialidades.find((e) => e.id === doc.especialidadId);
    const tarjeta = el('li', 'tarjeta');
    tarjeta.append(
      el('h3', '', `Dr/a. ${doc.nombre} ${doc.apellido} · ${esp.nombre}`), el('p', 'texto-suave', formatearFecha(v.fecha)),
      el('strong', '', 'Motivo de la consulta'), el('p', '', v.motivo), el('strong', '', 'Resultado'), el('p', '', v.resultado),
    );
    $('#lista').append(tarjeta);
  });
}
