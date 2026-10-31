import { hashClave } from '../utilidades/seguridad.js';

// Datos 100 % ficticios. Cada colección equivale a una tabla futura (claves foráneas = campos "...Id").
const CLAVE_DEMO = 'Demo1234';
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

export async function crearSemilla() {
  const passwordHash = await hashClave(CLAVE_DEMO);
  return {
    especialidades: [
      { id: 'esp-1', nombre: 'Clínica médica' }, { id: 'esp-2', nombre: 'Cardiología' },
      { id: 'esp-3', nombre: 'Pediatría' }, { id: 'esp-4', nombre: 'Dermatología' },
    ],
    usuarios: [
      { id: 'usr-1', rol: 'paciente', email: 'paciente@demo.test', passwordHash },
      { id: 'usr-2', rol: 'especialista', email: 'especialista@demo.test', passwordHash },
      { id: 'usr-3', rol: 'recepcion', email: 'recepcion@demo.test', passwordHash },
    ],
    pacientes: [
      { id: 'pac-1', usuarioId: 'usr-1', nombre: 'Lucía', apellido: 'Ramos', dni: '30111222', fechaNacimiento: '1990-04-12', telefono: '2610000000', email: 'paciente@demo.test' },
      { id: 'pac-2', usuarioId: null, nombre: 'Martín', apellido: 'Paz', dni: '28999888', fechaNacimiento: '1985-09-30', telefono: '2611111111', email: 'martin@demo.test' },
    ],
    especialistas: [
      { id: 'doc-1', usuarioId: null, nombre: 'Mariano', apellido: 'Quiroga', especialidadId: 'esp-1' },
      { id: 'doc-2', usuarioId: 'usr-2', nombre: 'Elena', apellido: 'Funes', especialidadId: 'esp-2' },
      { id: 'doc-3', usuarioId: null, nombre: 'Tomás', apellido: 'Aguirre', especialidadId: 'esp-3' },
      { id: 'doc-4', usuarioId: null, nombre: 'Sofía', apellido: 'Lemos', especialidadId: 'esp-4' },
    ],
    turnos: [
      { id: 'tur-1', pacienteId: 'pac-1', especialistaId: 'doc-2', fecha: dia(0), hora: '12:00', estado: 'confirmado' },
      { id: 'tur-2', pacienteId: 'pac-2', especialistaId: 'doc-2', fecha: dia(0), hora: '12:30', estado: 'pendiente' },
      { id: 'tur-3', pacienteId: 'pac-1', especialistaId: 'doc-1', fecha: dia(7), hora: '11:00', estado: 'pendiente' },
      { id: 'tur-4', pacienteId: 'pac-1', especialistaId: 'doc-2', fecha: dia(-30), hora: '09:00', estado: 'atendido' },
    ],
    historial: [
      { id: 'his-1', pacienteId: 'pac-1', especialistaId: 'doc-2', turnoId: 'tur-4', fecha: dia(-30), motivo: 'Control anual', resultado: 'Sin hallazgos. Control en 12 meses.' },
    ],
  };
}
