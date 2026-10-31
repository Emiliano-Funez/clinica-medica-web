import { hashClave } from '../utilidades/seguridad.js';

// Datos 100 % ficticios. Cada colección equivale a una tabla futura (claves foráneas = campos "...Id").
const CLAVE_DEMO = 'Demo1234';

export async function crearSemilla() {
  return {
    especialidades: [
      { id: 'esp-1', nombre: 'Clínica médica' },
      { id: 'esp-2', nombre: 'Cardiología' },
      { id: 'esp-3', nombre: 'Pediatría' },
      { id: 'esp-4', nombre: 'Dermatología' },
    ],
    usuarios: [{ id: 'usr-1', rol: 'paciente', email: 'paciente@demo.test', passwordHash: await hashClave(CLAVE_DEMO) }],
    pacientes: [{ id: 'pac-1', usuarioId: 'usr-1', nombre: 'Lucía', apellido: 'Ramos', dni: '30111222', fechaNacimiento: '1990-04-12', telefono: '2610000000' }],
    especialistas: [
      { id: 'doc-1', usuarioId: null, nombre: 'Mariano', apellido: 'Quiroga', especialidadId: 'esp-1' },
      { id: 'doc-2', usuarioId: null, nombre: 'Elena', apellido: 'Funes', especialidadId: 'esp-2' },
      { id: 'doc-3', usuarioId: null, nombre: 'Tomás', apellido: 'Aguirre', especialidadId: 'esp-3' },
      { id: 'doc-4', usuarioId: null, nombre: 'Sofía', apellido: 'Lemos', especialidadId: 'esp-4' },
    ],
    turnos: [
      { id: 'tur-1', pacienteId: 'pac-1', especialistaId: 'doc-2', fecha: '2026-11-04', hora: '09:30', estado: 'confirmado' },
      { id: 'tur-2', pacienteId: 'pac-1', especialistaId: 'doc-1', fecha: '2026-11-11', hora: '11:00', estado: 'pendiente' },
    ],
    historial: [],
  };
}
