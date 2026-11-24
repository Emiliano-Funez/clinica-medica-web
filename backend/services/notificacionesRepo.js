// Acceso a MySQL/MariaDB para el módulo de notificaciones.
function crearRepoMysql(db) {
  return {
    async turnoCompleto(id) {
      const [r] = await db.query(`SELECT t.id_turno id,t.fecha,LEFT(t.horario,5) hora,t.estado,
          pp.id_persona pid,pp.nombre pnom,pp.apellido pape,pp.email,pp.num_celular tel,
          pe.nombre mnom,pe.apellido mape,es.nombre esp
        FROM turno t
        JOIN persona_rol prp ON prp.id_persona_rol=t.id_paciente JOIN persona pp ON pp.id_persona=prp.id_persona
        JOIN persona_rol pre ON pre.id_persona_rol=t.id_especialista JOIN persona pe ON pe.id_persona=pre.id_persona
        LEFT JOIN especialista e ON e.id_persona_rol=t.id_especialista LEFT JOIN especialidad es ON es.id_especialidad=e.id_especialidad
        WHERE t.id_turno=?`, [id]);
      const x = r[0];
      return x && { id: x.id, fecha: x.fecha, hora: x.hora, estado: x.estado, medico: `${x.mnom} ${x.mape}`.trim(), especialidad: x.esp || null,
        paciente: { id: x.pid, nombre: x.pnom, apellido: x.pape, email: x.email, telefono: x.tel } };
    },
    // Crea el registro "pendiente". Si ya existía (mismo turno + canal + clave) devuelve el existente: así no hay duplicados.
    async reservar(d) {
      try {
        const [r] = await db.query('INSERT INTO notificacion(id_turno,id_paciente,tipo,clave,canal,destino,estado) VALUES(?,?,?,?,?,?,?)',
          [d.idTurno, d.idPaciente, d.tipo, d.clave, d.canal, d.destino, 'pendiente']);
        return { id: r.insertId, nueva: true, estado: 'pendiente', intentos: 0, minutos: 0 };
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
        const [x] = await db.query('SELECT id_notificacion id,estado,intentos,TIMESTAMPDIFF(MINUTE,actualizado,NOW()) minutos FROM notificacion WHERE id_turno=? AND canal=? AND clave=?', [d.idTurno, d.canal, d.clave]);
        return { ...x[0], nueva: false };
      }
    },
    async marcar(id, estado, { error = null, proveedor = null, intentos = 0 } = {}) {
      await db.query('UPDATE notificacion SET estado=?,error=?,proveedor_id=?,intentos=? WHERE id_notificacion=?', [estado, error && String(error).slice(0, 300), proveedor, intentos, id]);
    },
    async turnosEntre(desde, hasta) {
      const [r] = await db.query("SELECT id_turno id FROM turno WHERE estado='confirmado' AND TIMESTAMP(fecha,horario)>? AND TIMESTAMP(fecha,horario)<=?", [desde, hasta]);
      return r;
    },
    async pendientesDeReintento(max) {
      const [r] = await db.query("SELECT id_notificacion id,id_turno,tipo,clave,canal,intentos FROM notificacion WHERE id_turno IS NOT NULL AND estado IN ('pendiente','error') AND intentos<? AND actualizado<NOW()-INTERVAL 10 MINUTE ORDER BY id_notificacion LIMIT 50", [max]);
      return r;
    },
    async listar(idTurno) {
      const [r] = await db.query('SELECT id_notificacion id,tipo,canal,destino,estado,intentos,error,creado,actualizado FROM notificacion WHERE id_turno=? ORDER BY id_notificacion', [idTurno]);
      return r;
    },
    async resumen() {
      const [r] = await db.query('SELECT id_turno turno,tipo,canal,estado,error FROM notificacion WHERE id_turno IS NOT NULL AND creado>=NOW()-INTERVAL 14 DAY ORDER BY id_notificacion');
      return r;
    }
  };
}
module.exports = { crearRepoMysql };
