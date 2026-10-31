import { repositorio } from '../data/repositorio.js';

export async function altaPaciente(d) {
  const email = d.email.trim().toLowerCase();
  const [porDni, usuarioEmail, pacienteEmail] = await Promise.all([
    repositorio.listar('pacientes', { dni: d.dni }), repositorio.listar('usuarios', { email }), repositorio.listar('pacientes', { email }),
  ]);
  if (porDni.length || usuarioEmail.length || pacienteEmail.length) throw new Error('Este paciente ya está registrado (el DNI o el email ya existen).');
  return repositorio.crear('pacientes', {
    usuarioId: null, nombre: d.nombre.trim(), apellido: d.apellido.trim(), dni: d.dni,
    fechaNacimiento: d.fechaNacimiento, telefono: d.telefono.trim(), email,
  });
}

export async function buscarPorDni(dni) {
  return (await repositorio.listar('pacientes', { dni: dni.trim() }))[0] ?? null;
}
