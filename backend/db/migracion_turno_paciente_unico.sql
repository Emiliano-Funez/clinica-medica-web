-- Evita que un paciente tenga dos turnos activos el mismo día y a la misma hora,
-- incluso si son con especialistas distintos. Los cancelados quedan fuera del índice.
USE base_de_datos_clinica;

-- Primero muestra las colisiones existentes. Si hay alguna, el índice se omite
-- para no borrar ni cancelar turnos automáticamente.
SELECT id_persona_rol_paciente,
       DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
       LEFT(horario, 5) AS hora,
       GROUP_CONCAT(CONCAT(id_turno, ':', LOWER(estado)) ORDER BY id_turno) AS turnos,
       COUNT(*) AS cantidad
FROM turno
WHERE horario_ocupado = 1
GROUP BY id_persona_rol_paciente, fecha, horario
HAVING COUNT(*) > 1;

SET @duplicados = (
  SELECT COUNT(*) FROM (
    SELECT id_persona_rol_paciente, fecha, horario
    FROM turno
    WHERE horario_ocupado = 1
    GROUP BY id_persona_rol_paciente, fecha, horario
    HAVING COUNT(*) > 1
  ) AS colisiones
);

SET @indice_existe = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'turno'
    AND index_name = 'uq_turno_paciente_fecha_horario'
);

SET @sql_migracion = IF(
  @indice_existe > 0,
  'SELECT ''La restricción de horario único por paciente ya existe'' AS resultado',
  IF(
    @duplicados > 0,
    CONCAT('SELECT ''No se agregó la restricción: hay ', @duplicados,
      ' colisión(es) activa(s). Revisá el resultado anterior, resolvelas y volvé a ejecutar este archivo.'' AS resultado'),
    'ALTER TABLE turno ADD UNIQUE KEY uq_turno_paciente_fecha_horario (id_persona_rol_paciente, fecha, horario, horario_ocupado)'
  )
);

PREPARE stmt_migracion FROM @sql_migracion;
EXECUTE stmt_migracion;
DEALLOCATE PREPARE stmt_migracion;
