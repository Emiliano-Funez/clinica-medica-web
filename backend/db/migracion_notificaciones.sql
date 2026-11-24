-- Ejecutar UNA vez si ya tenías la base cargada antes de agregar Gmail / SMS.
-- Justificación: el sistema necesita un historial de avisos (quién, qué turno, canal, estado y error),
-- evitar duplicados y reintentar los fallidos. No modifica ninguna tabla existente.
-- Reemplaza la columna turno.recordatorio_enviado de la fase anterior (Twilio): si la agregaste, ya no se usa y podés ignorarla.
USE clinicamed;
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

