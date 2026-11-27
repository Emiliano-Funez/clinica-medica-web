-- Esquema compatible con la base original de ClinicaMed (persona_especialidad y turnos por persona_rol).
-- Se puede ejecutar para una instalación nueva; no contiene DROP ni borra datos.
CREATE DATABASE IF NOT EXISTS base_de_datos_clinica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE base_de_datos_clinica;

CREATE TABLE IF NOT EXISTS persona (
  id_persona INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dni VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  apellido VARCHAR(60) NOT NULL,
  fecha_nacimiento DATE NULL,
  nombre VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  num_celular VARCHAR(25) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rol (
  id_rol INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persona_rol (
  id_persona_rol INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_persona INT NOT NULL,
  id_rol INT NOT NULL,
  UNIQUE KEY uq_persona_rol (id_persona,id_rol),
  KEY fk_persona_rol_rol (id_rol),
  CONSTRAINT fk_persona_rol_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona),
  CONSTRAINT fk_persona_rol_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS especialidad (
  id_especialidad INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persona_especialidad (
  id_persona_especialidad INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_persona_rol INT NOT NULL UNIQUE,
  id_especialidad INT NOT NULL,
  matricula VARCHAR(30) NOT NULL UNIQUE,
  KEY fk_persona_especialidad_especialidad (id_especialidad),
  CONSTRAINT fk_persona_especialidad_especialidad FOREIGN KEY (id_especialidad) REFERENCES especialidad(id_especialidad),
  CONSTRAINT fk_persona_especialidad_persona_rol FOREIGN KEY (id_persona_rol) REFERENCES persona_rol(id_persona_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS turno (
  id_turno INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_persona_rol_paciente INT NOT NULL,
  id_persona_rol_especialista INT NOT NULL,
  fecha DATE NOT NULL,
  horario TIME NOT NULL,
  estado ENUM('PENDIENTE','CONFIRMADO','ATENDIDO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  horario_ocupado TINYINT GENERATED ALWAYS AS (IF(estado='CANCELADO',NULL,1)) STORED,
  UNIQUE KEY uq_turno_especialista_fecha_horario (id_persona_rol_especialista,fecha,horario,horario_ocupado),
  UNIQUE KEY uq_turno_paciente_fecha_horario (id_persona_rol_paciente,fecha,horario,horario_ocupado),
  KEY fk_turno_paciente (id_persona_rol_paciente),
  CONSTRAINT fk_turno_especialista FOREIGN KEY (id_persona_rol_especialista) REFERENCES persona_rol(id_persona_rol),
  CONSTRAINT fk_turno_paciente FOREIGN KEY (id_persona_rol_paciente) REFERENCES persona_rol(id_persona_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_clinico (
  id_historial INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_turno INT NOT NULL UNIQUE,
  id_persona_rol_carga INT NOT NULL,
  fecha_registro DATE NOT NULL,
  motivo VARCHAR(255) NULL,
  resultado TEXT NULL,
  KEY fk_historial_carga (id_persona_rol_carga),
  CONSTRAINT fk_historial_carga FOREIGN KEY (id_persona_rol_carga) REFERENCES persona_rol(id_persona_rol),
  CONSTRAINT fk_historial_turno FOREIGN KEY (id_turno) REFERENCES turno(id_turno)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  UNIQUE (id_turno,canal,clave),
  CONSTRAINT fk_notificacion_turno FOREIGN KEY (id_turno) REFERENCES turno(id_turno) ON DELETE CASCADE,
  CONSTRAINT fk_notificacion_paciente FOREIGN KEY (id_paciente) REFERENCES persona(id_persona) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO rol(nombre) VALUES ('ESPECIALISTA'),('PACIENTE'),('ADMINISTRATIVO');
INSERT IGNORE INTO especialidad(nombre,descripcion) VALUES
  ('Clínica médica',NULL),('Cardiología',NULL),('Pediatría',NULL),('Dermatología',NULL);
