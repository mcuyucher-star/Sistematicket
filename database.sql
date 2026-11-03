-- =========================================================================
-- Base de Datos: sistema_tickets_db
-- Sistema de Gestión de Tickets y Mesa de Ayuda (IT & Operaciones)
-- Mundi Trofeos · Tiendas Trofex · Premia
-- =========================================================================

CREATE DATABASE IF NOT EXISTS sistema_tickets_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistema_tickets_db;

-- 1. Tabla de Usuarios (Solicitantes, Técnicos y Administradores)
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(32) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('solicitante', 'tecnico', 'admin') NOT NULL DEFAULT 'solicitante',
  sucursal VARCHAR(120) DEFAULT 'Sede Central',
  pais VARCHAR(60) DEFAULT 'Guatemala',
  telefono VARCHAR(40) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabla de Categorías de Tickets
CREATE TABLE IF NOT EXISTS categorias (
  id VARCHAR(32) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  sla_horas INT NOT NULL DEFAULT 24,
  icono VARCHAR(50) DEFAULT 'life-buoy',
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 3. Tabla Principal de Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(32) PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria_id VARCHAR(32) NOT NULL,
  categoria_nombre VARCHAR(100) NOT NULL,
  prioridad ENUM('Baja', 'Media', 'Alta', 'Crítica') NOT NULL DEFAULT 'Media',
  estado ENUM('Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado') NOT NULL DEFAULT 'Abierto',
  solicitante_id VARCHAR(32) NOT NULL,
  solicitante_nombre VARCHAR(120) NOT NULL,
  solicitante_email VARCHAR(120) DEFAULT NULL,
  solicitante_telefono VARCHAR(40) DEFAULT NULL,
  sucursal VARCHAR(120) NOT NULL,
  pais VARCHAR(60) NOT NULL DEFAULT 'Guatemala',
  equipo_serie VARCHAR(120) DEFAULT NULL,
  tecnico_id VARCHAR(32) DEFAULT NULL,
  tecnico_nombre VARCHAR(120) DEFAULT 'Sin asignar',
  evidencia_base64 LONGTEXT DEFAULT NULL,
  notas_resolucion TEXT DEFAULT NULL,
  fecha_creacion DATETIME NOT NULL,
  fecha_actualizacion DATETIME NOT NULL,
  fecha_cierre DATETIME DEFAULT NULL
) ENGINE=InnoDB;

-- 4. Tabla de Comentarios / Seguimiento del Ticket
CREATE TABLE IF NOT EXISTS ticket_comentarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(32) NOT NULL,
  autor_nombre VARCHAR(120) NOT NULL,
  autor_rol VARCHAR(40) NOT NULL,
  mensaje TEXT NOT NULL,
  fecha DATETIME NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Datos semilla iniciales
INSERT IGNORE INTO categorias (id, nombre, descripcion, sla_horas, icono) VALUES
('cat_pos', 'Sistema POS / Facturación', 'Fallas en punto de venta, emisión de facturas FEL o cierres de caja', 4, 'monitor'),
('cat_hw', 'Hardware / Equipos de Cómputo', 'PC no enciende, monitor, teclado, lector de código de barras o UPS', 12, 'cpu'),
('cat_red', 'Redes e Internet', 'Caída de internet en tienda, Wi-Fi lento, VPN o cableado de red', 6, 'wifi'),
('cat_imp', 'Impresoras y Etiquetadoras', 'Impresora térmica de tickets, láser o de etiquetas atascada/sin conexión', 8, 'printer'),
('cat_acc', 'Accesos, Correo y Cuentas', 'Restablecimiento de contraseñas, permisos de usuario o cuentas de correo', 4, 'key'),
('cat_inf', 'Infraestructura / Mantenimiento Tienda', 'Iluminación, aire acondicionado, cámaras de seguridad o mobiliario', 24, 'building-2');
