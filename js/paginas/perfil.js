import { exigirRol, cerrarSesion, cambiarClave } from '../servicios/auth.js';
import { repositorio } from '../data/repositorio.js';
import { iniciarCabecera } from '../componentes/header.js';
import { $, mostrarAviso } from '../utilidades/dom.js';

iniciarCabecera();
const usuario = await exigirRol('paciente');
if (usuario) iniciar(usuario);

async function iniciar(usuario) {
  let [paciente] = await repositorio.listar('pacientes', { usuarioId: usuario.id });
  const f = $('#form-perfil');
  const editables = ['nombre', 'apellido', 'fechaNacimiento', 'telefono'];
  const pintar = () => {
    ['nombre', 'apellido', 'dni', 'fechaNacimiento', 'telefono'].forEach((c) => { f[c].value = paciente[c]; });
    f.email.value = usuario.email;
    $('#iniciales').textContent = `${paciente.nombre[0]}${paciente.apellido[0]}`;
    $('#nombre-completo').textContent = `${paciente.nombre} ${paciente.apellido}`;
    $('#dni-lateral').textContent = `DNI ${paciente.dni} · Paciente`;
  };
  const modoEdicion = (activo) => {
    editables.forEach((c) => { f[c].disabled = !activo; });
    $('#editar').hidden = activo; $('#guardar').hidden = !activo; $('#cancelar').hidden = !activo;
  };
  pintar();
  modoEdicion(false);
  $('#editar').addEventListener('click', () => modoEdicion(true));
  $('#cancelar').addEventListener('click', () => { pintar(); modoEdicion(false); mostrarAviso($('#aviso'), ''); });
  f.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!f.reportValidity()) return;
    paciente = await repositorio.actualizar('pacientes', paciente.id, Object.fromEntries(editables.map((c) => [c, f[c].value.trim()])));
    pintar(); modoEdicion(false);
    mostrarAviso($('#aviso'), 'Datos actualizados.', 'ok');
  });

  const dialogo = $('#dialogo-clave');
  const formClave = $('#form-clave');
  $('#abrir-clave').addEventListener('click', () => { formClave.reset(); mostrarAviso($('#aviso-clave'), ''); dialogo.showModal(); });
  $('#cerrar-clave').addEventListener('click', () => dialogo.close());
  formClave.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!formClave.reportValidity()) return;
    try {
      await cambiarClave(usuario, formClave.actual.value, formClave.nueva.value);
      dialogo.close();
      mostrarAviso($('#aviso'), 'Contraseña actualizada.', 'ok');
    } catch (error) { mostrarAviso($('#aviso-clave'), error.message); }
  });
  $('#salir').addEventListener('click', cerrarSesion);
}
