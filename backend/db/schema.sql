-- ClinicaMed · Base de datos (MariaDB 10.5+, compatible con MySQL 8) · MER corregido
-- PERSONA ROL es la entidad asociativa: de ahí cuelgan ESPECIALISTA (matrícula/especialidad),
-- TURNO (paciente y especialista) y la carga de HISTORIAL_CLINICO (relación débil, depende de TURNO).
CREATE DATABASE IF NOT EXISTS clinicamed CHARACTER SET utf8mb4;
USE clinicamed;

CREATE TABLE persona (
  id_persona      INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(60)  NOT NULL,
  apellido        VARCHAR(60)  NOT NULL,
  dni             VARCHAR(10)  NOT NULL UNIQUE,
  fecha_nacimiento DATE        NULL,
  email           VARCHAR(120) NOT NULL UNIQUE,
  contrasena      VARCHAR(255) NOT NULL,          -- guardar hash (bcrypt), nunca texto plano
  num_celular     VARCHAR(25)  NULL
);

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre ENUM('paciente','especialista','recepcion') NOT NULL UNIQUE
);

CREATE TABLE persona_rol (                         -- entidad asociativa PERSONA–ROL
  id_persona_rol INT AUTO_INCREMENT PRIMARY KEY,
  id_persona INT NOT NULL,
  id_rol     INT NOT NULL,
  UNIQUE (id_persona, id_rol),
  FOREIGN KEY (id_persona) REFERENCES persona(id_persona) ON DELETE CASCADE,
  FOREIGN KEY (id_rol)     REFERENCES rol(id_rol)
);

CREATE TABLE especialidad (
  id_especialidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE especialista (                        -- ESPECIALIDAD colgada de PERSONA ROL
  id_persona_rol  INT PRIMARY KEY,
  id_especialidad INT NOT NULL,
  matricula       VARCHAR(20) NOT NULL UNIQUE,
  FOREIGN KEY (id_persona_rol)  REFERENCES persona_rol(id_persona_rol) ON DELETE CASCADE,
  FOREIGN KEY (id_especialidad) REFERENCES especialidad(id_especialidad)
);

CREATE TABLE turno (                               -- TURNO colgado de PERSONA ROL
  id_turno        INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente     INT NOT NULL,                    -- persona_rol con rol paciente
  id_especialista INT NOT NULL,                    -- persona_rol con rol especialista
  id_creador      INT NOT NULL,                    -- quién lo cargó (paciente o recepción)
  fecha           DATE NOT NULL,
  horario         TIME NOT NULL,
  estado ENUM('pendiente','confirmado','atendido','cancelado') NOT NULL DEFAULT 'pendiente',
  UNIQUE (id_especialista, fecha, horario),         -- evita doble reserva del mismo horario
  FOREIGN KEY (id_paciente)     REFERENCES persona_rol(id_persona_rol),
  FOREIGN KEY (id_especialista) REFERENCES persona_rol(id_persona_rol),
  FOREIGN KEY (id_creador)      REFERENCES persona_rol(id_persona_rol)
);

CREATE TABLE historial_clinico (                   -- entidad débil: depende del turno
  id_historial   INT AUTO_INCREMENT PRIMARY KEY,
  id_turno       INT NOT NULL UNIQUE,
  id_persona_rol INT NOT NULL,                     -- especialista que CARGA la entrada
  motivo         VARCHAR(200) NOT NULL,
  resultado      TEXT NOT NULL,
  fecha_carga    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_turno)       REFERENCES turno(id_turno) ON DELETE CASCADE,
  FOREIGN KEY (id_persona_rol) REFERENCES persona_rol(id_persona_rol)
);

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
  id_turno     INT NULL,
  id_paciente  INT NULL,
  tipo         VARCHAR(30) NOT NULL,   -- confirmacion, confirmado, modificacion, cancelacion, recordatorio_24h, recordatorio_2h
  clave        VARCHAR(80) NOT NULL,   -- identifica el aviso (ej. recordatorio_24h:2026-11-23 10:30); evita duplicados
  canal        ENUM('email','sms','whatsapp') NOT NULL,
  destino      VARCHAR(160) NULL,      -- correo o teléfono enmascarado (no se guarda completo)
  estado       ENUM('pendiente','enviado','error','omitido','prueba') NOT NULL DEFAULT 'pendiente',
  intentos     TINYINT NOT NULL DEFAULT 0,
  error        VARCHAR(300) NULL,
  proveedor_id VARCHAR(120) NULL,
  creado       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (id_turno, canal, clave),
  FOREIGN KEY (id_turno)    REFERENCES turno(id_turno) ON DELETE CASCADE,
  FOREIGN KEY (id_paciente) REFERENCES persona(id_persona) ON DELETE SET NULL
);

-- Catálogos iniciales (los usuarios de demo los crea seed.js con contraseña hasheada)
INSERT INTO rol (nombre) VALUES ('paciente'),('especialista'),('recepcion');
INSERT INTO especialidad (nombre) VALUES ('Clínico General'),('Pediatría'),('Cardiología'),('Dermatología');
