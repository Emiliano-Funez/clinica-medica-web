-- Seleccioná en Workbench la base indicada por DB_NAME antes de ejecutar este archivo.
-- Agrega solo los campos necesarios; no elimina ni reemplaza registros existentes.

SET @schema_actual = DATABASE();
SET @fecha_nacimiento_existe = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_actual
    AND TABLE_NAME = 'persona'
    AND COLUMN_NAME = 'fecha_nacimiento'
);
SET @sql_fecha_nacimiento = IF(
  @fecha_nacimiento_existe = 0,
  'ALTER TABLE persona ADD COLUMN fecha_nacimiento DATE NULL AFTER apellido',
  'SELECT ''persona.fecha_nacimiento ya existe'' AS migracion'
);
PREPARE stmt_fecha_nacimiento FROM @sql_fecha_nacimiento;
EXECUTE stmt_fecha_nacimiento;
DEALLOCATE PREPARE stmt_fecha_nacimiento;

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
  id_turno INT NULL,
  id_paciente INT NULL,
  tipo VARCHAR(30) NOT NULL,
  clave VARCHAR(80) NOT NULL,
  canal ENUM('email','sms','whatsapp') NOT NULL,
  destino VARCHAR(160) NULL,
  estado ENUM('pendiente','enviado','error','omitido','prueba') NOT NULL DEFAULT 'pendiente',
  intentos TINYINT NOT NULL DEFAULT 0,
  error VARCHAR(300) NULL,
  proveedor_id VARCHAR(120) NULL,
  creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (id_turno, canal, clave),
  CONSTRAINT fk_notificacion_turno FOREIGN KEY (id_turno)
    REFERENCES turno(id_turno) ON DELETE CASCADE,
  CONSTRAINT fk_notificacion_paciente FOREIGN KEY (id_paciente)
    REFERENCES persona(id_persona) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
