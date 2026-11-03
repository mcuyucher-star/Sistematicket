<?php
/**
 * Configuración y Auto-Inicialización de Base de Datos (PHP PDO + MySQL)
 * Sistema de Gestión de Tickets y Mesa de Ayuda IT
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

date_default_timezone_set('America/Guatemala');

class Database {
    private static $host = '127.0.0.1';
    private static $user = 'root';
    private static $pass = '';
    private static $dbName = 'sistema_tickets_db';
    private static $pdo = null;
    private static $error = null;

    public static function getConnection(): ?PDO {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        try {
            $dsn = "mysql:host=" . self::$host . ";charset=utf8mb4";
            $pdo = new PDO($dsn, self::$user, self::$pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);

            $dbName = self::$dbName;
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `$dbName`");

            self::initializeSchema($pdo);
            self::$pdo = $pdo;
            return self::$pdo;
        } catch (PDOException $e) {
            self::$error = $e->getMessage();
            return null;
        }
    }

    public static function getLastError(): ?string {
        return self::$error;
    }

    private static function initializeSchema(PDO $pdo): void {
        // 1. Tabla de Categorías con SLA
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS categorias (
                id VARCHAR(32) PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                sla_horas INT NOT NULL DEFAULT 8,
                icono VARCHAR(40) NOT NULL DEFAULT 'tag'
            ) ENGINE=InnoDB;
        ");

        // 2. Tabla de Usuarios y Técnicos
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS usuarios (
                id VARCHAR(32) PRIMARY KEY,
                nombre VARCHAR(120) NOT NULL,
                rol VARCHAR(30) NOT NULL DEFAULT 'solicitante',
                sucursal VARCHAR(120) NOT NULL,
                pais VARCHAR(60) NOT NULL DEFAULT 'Guatemala',
                email VARCHAR(120) NOT NULL,
                telefono VARCHAR(40) DEFAULT NULL,
                pin VARCHAR(30) DEFAULT '1234'
            ) ENGINE=InnoDB;
        ");

        // 3. Tabla de Tickets
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tickets (
                id VARCHAR(32) PRIMARY KEY,
                codigo VARCHAR(30) NOT NULL UNIQUE,
                titulo VARCHAR(200) NOT NULL,
                descripcion TEXT NOT NULL,
                categoria_id VARCHAR(32) NOT NULL,
                categoria_nombre VARCHAR(100) NOT NULL,
                prioridad VARCHAR(30) NOT NULL DEFAULT 'Media',
                estado VARCHAR(40) NOT NULL DEFAULT 'Abierto',
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
                comentarios_json LONGTEXT DEFAULT NULL,
                fecha_creacion DATETIME NOT NULL,
                fecha_actualizacion DATETIME NOT NULL
            ) ENGINE=InnoDB;
        ");

        self::seedDefaults($pdo);
    }

    private static function seedDefaults(PDO $pdo): void {
        // Seed categorías si está vacía
        $countCat = (int) $pdo->query("SELECT COUNT(*) FROM categorias")->fetchColumn();
        if ($countCat === 0) {
            $categorias = [
                ['cat_pos', 'Sistema POS / Facturación FEL', 4, 'monitor'],
                ['cat_hw', 'Hardware / Equipos de Cómputo', 12, 'cpu'],
                ['cat_red', 'Redes, Internet y VPN', 6, 'wifi'],
                ['cat_imp', 'Impresoras y Etiquetadoras', 8, 'printer'],
                ['cat_acc', 'Accesos, Correo y Cuentas', 4, 'key'],
                ['cat_inf', 'Infraestructura / Tienda', 24, 'building-2']
            ];
            $stmt = $pdo->prepare("INSERT INTO categorias (id, nombre, sla_horas, icono) VALUES (?, ?, ?, ?)");
            foreach ($categorias as $c) {
                $stmt->execute($c);
            }
        }

        // Seed usuarios si está vacía
        $countUsers = (int) $pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn();
        if ($countUsers === 0) {
            $usuarios = [
                ['u1', 'Andrea Morales', 'solicitante', 'Tienda Trofex Zona 9', 'Guatemala', 'andrea.morales@munditrofeos.com', '+502 5511-2233', '1234'],
                ['u2', 'Carlos Pérez', 'solicitante', 'Bodega & Logística Central', 'Guatemala', 'carlos.perez@munditrofeos.com', '+502 5544-1234', '1234'],
                ['u3', 'Gabriela Castillo', 'solicitante', 'Tienda Premia San Salvador', 'El Salvador', 'gabriela.castillo@munditrofeos.com', '+503 7711-8899', '1234'],
                ['u4', 'Jorge Valladares', 'solicitante', 'Tienda Mundi Trofeos San Pedro Sula', 'Honduras', 'jorge.valladares@munditrofeos.com', '+504 9900-1122', '1234'],
                ['u5', 'Valeria Solís', 'solicitante', 'Tienda Trofex San José', 'Costa Rica', 'valeria.solis@munditrofeos.com', '+506 8833-4455', '1234'],
                ['t1', 'Ing. Diego Ramírez (Soporte IT Nivel 2)', 'admin', 'Sede Central IT', 'Guatemala', 'it.soporte@munditrofeos.com', '+502 4400-9900', 'admin123'],
                ['t2', 'Kevin Hernández (Redes & Equipos)', 'admin', 'Sede Central IT', 'Guatemala', 'kevin.it@munditrofeos.com', '+502 4400-9911', 'admin123'],
                ['t3', 'Sofía Méndez (Sistemas POS & ERP)', 'admin', 'Soporte Regional CA', 'El Salvador', 'sofia.sistemas@munditrofeos.com', '+503 7100-2200', 'admin123']
            ];
            $stmt = $pdo->prepare("INSERT INTO usuarios (id, nombre, rol, sucursal, pais, email, telefono, pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($usuarios as $u) {
                $stmt->execute($u);
            }
        }

        // Seed tickets iniciales si está vacía
        $countTickets = (int) $pdo->query("SELECT COUNT(*) FROM tickets")->fetchColumn();
        if ($countTickets === 0) {
            $now = date('Y-m-d H:i:s');
            $t1Date = date('Y-m-d H:i:s', strtotime('-2 hours'));
            $t2Date = date('Y-m-d H:i:s', strtotime('-1 hour'));
            $t3Date = date('Y-m-d H:i:s', strtotime('-18 hours'));

            $seedTickets = [
                [
                    'id' => 'tkt_1001',
                    'codigo' => 'TKT-2026-001',
                    'titulo' => 'Impresora térmica de caja 1 no corta papel y marca luz roja',
                    'descripcion' => 'Al emitir factura FEL en mostrador principal la impresora Epson TM-T20III se queda con el LED de error parpadeando y no imprime el comprobante.',
                    'categoria_id' => 'cat_imp',
                    'categoria_nombre' => 'Impresoras y Etiquetadoras',
                    'prioridad' => 'Alta',
                    'estado' => 'En Proceso',
                    'solicitante_id' => 'u1',
                    'solicitante_nombre' => 'Andrea Morales',
                    'solicitante_email' => 'andrea.morales@munditrofeos.com',
                    'solicitante_telefono' => '+502 5511-2233',
                    'sucursal' => 'Tienda Trofex Zona 9',
                    'pais' => 'Guatemala',
                    'equipo_serie' => 'IMP-Z9-01 / Epson TM-T20',
                    'tecnico_id' => 't2',
                    'tecnico_nombre' => 'Kevin Hernández (Redes & Equipos)',
                    'evidencia_base64' => null,
                    'notas_resolucion' => 'Se revisó vía AnyDesk la cola de impresión y se programó limpieza de cabezal térmico.',
                    'comentarios_json' => json_encode([
                        [
                            'author' => 'Andrea Morales',
                            'role' => 'Solicitante',
                            'date' => date('d/m/Y H:i', strtotime($t1Date)),
                            'text' => 'Adjunto reporte, tenemos clientes en fila esperando factura.'
                        ],
                        [
                            'author' => 'Kevin Hernández (Redes & Equipos)',
                            'role' => 'Soporte IT',
                            'date' => date('d/m/Y H:i', strtotime($t1Date . ' +15 minutes')),
                            'text' => 'Recibido Andrea, me conecto por AnyDesk en 3 minutos para desviar la impresión a Caja 2 mientras destrabamos la cuchilla.'
                        ]
                    ], JSON_UNESCAPED_UNICODE),
                    'fecha_creacion' => $t1Date,
                    'fecha_actualizacion' => $now
                ],
                [
                    'id' => 'tkt_1002',
                    'codigo' => 'TKT-2026-002',
                    'titulo' => 'Error de conexión con certificador FEL al facturar con NIT',
                    'descripcion' => 'El sistema POS muestra mensaje "Timeout Certificador" cuando intentamos facturar pedidos mayores a Q2,500.',
                    'categoria_id' => 'cat_pos',
                    'categoria_nombre' => 'Sistema POS / Facturación FEL',
                    'prioridad' => 'Crítica',
                    'estado' => 'Abierto',
                    'solicitante_id' => 'u3',
                    'solicitante_nombre' => 'Gabriela Castillo',
                    'solicitante_email' => 'gabriela.castillo@munditrofeos.com',
                    'solicitante_telefono' => '+503 7711-8899',
                    'sucursal' => 'Tienda Premia San Salvador',
                    'pais' => 'El Salvador',
                    'equipo_serie' => 'POS-SV-CAJA01',
                    'tecnico_id' => 't3',
                    'tecnico_nombre' => 'Sofía Méndez (Sistemas POS & ERP)',
                    'evidencia_base64' => null,
                    'notas_resolucion' => '',
                    'comentarios_json' => json_encode([
                        [
                            'author' => 'Gabriela Castillo',
                            'role' => 'Solicitante',
                            'date' => date('d/m/Y H:i', strtotime($t2Date)),
                            'text' => 'Urge apoyo por favor, tenemos dos pedidos corporativos pendientes de facturar.'
                        ]
                    ], JSON_UNESCAPED_UNICODE),
                    'fecha_creacion' => $t2Date,
                    'fecha_actualizacion' => $now
                ],
                [
                    'id' => 'tkt_1003',
                    'codigo' => 'TKT-2026-003',
                    'titulo' => 'Solicitud de creación de correo y acceso para nuevo asesor de ventas',
                    'descripcion' => 'Solicito crear cuenta de correo corporativo y usuario de sistema para el nuevo integrante de sala de ventas.',
                    'categoria_id' => 'cat_acc',
                    'categoria_nombre' => 'Accesos, Correo y Cuentas',
                    'prioridad' => 'Baja',
                    'estado' => 'Resuelto',
                    'solicitante_id' => 'u4',
                    'solicitante_nombre' => 'Jorge Valladares',
                    'solicitante_email' => 'jorge.valladares@munditrofeos.com',
                    'solicitante_telefono' => '+504 9900-1122',
                    'sucursal' => 'Tienda Mundi Trofeos San Pedro Sula',
                    'pais' => 'Honduras',
                    'equipo_serie' => 'PC-VENTAS-SPS03',
                    'tecnico_id' => 't1',
                    'tecnico_nombre' => 'Ing. Diego Ramírez (Soporte IT Nivel 2)',
                    'evidencia_base64' => null,
                    'notas_resolucion' => 'Cuenta creada en Microsoft 365 y credenciales enviadas al encargado de tienda.',
                    'comentarios_json' => json_encode([
                        [
                            'author' => 'Ing. Diego Ramírez (Soporte IT Nivel 2)',
                            'role' => 'Soporte IT',
                            'date' => date('d/m/Y H:i', strtotime($t3Date . ' +2 hours')),
                            'text' => 'Cuenta activada y permisos asignados en módulo de facturación.'
                        ]
                    ], JSON_UNESCAPED_UNICODE),
                    'fecha_creacion' => $t3Date,
                    'fecha_actualizacion' => $now
                ]
            ];

            $stmt = $pdo->prepare("
                INSERT INTO tickets (
                    id, codigo, titulo, descripcion, categoria_id, categoria_nombre,
                    prioridad, estado, solicitante_id, solicitante_nombre,
                    solicitante_email, solicitante_telefono, sucursal, pais,
                    equipo_serie, tecnico_id, tecnico_nombre, evidencia_base64,
                    notas_resolucion, comentarios_json, fecha_creacion, fecha_actualizacion
                ) VALUES (
                    :id, :codigo, :titulo, :descripcion, :categoria_id, :categoria_nombre,
                    :prioridad, :estado, :solicitante_id, :solicitante_nombre,
                    :solicitante_email, :solicitante_telefono, :sucursal, :pais,
                    :equipo_serie, :tecnico_id, :tecnico_nombre, :evidencia_base64,
                    :notas_resolucion, :comentarios_json, :fecha_creacion, :fecha_actualizacion
                )
            ");

            foreach ($seedTickets as $t) {
                $stmt->execute($t);
            }
        }
    }

    /**
     * Convierte una fila MySQL de ticket al formato JSON esperado por el Frontend
     */
    public static function mapTicketRow(array $row): array {
        $comments = [];
        if (!empty($row['comentarios_json'])) {
            $decoded = json_decode($row['comentarios_json'], true);
            if (is_array($decoded)) {
                $comments = $decoded;
            }
        }

        $createdAtSql = $row['fecha_creacion'] ?? date('Y-m-d H:i:s');
        $timestamp = strtotime($createdAtSql);
        $createdAtDisplay = $timestamp ? date('d/m/Y H:i', $timestamp) : $createdAtSql;

        return [
            'id' => $row['id'],
            'code' => $row['codigo'],
            'title' => $row['titulo'],
            'description' => $row['descripcion'],
            'categoryId' => $row['categoria_id'],
            'categoryName' => $row['categoria_nombre'],
            'priority' => $row['prioridad'],
            'status' => $row['estado'],
            'requesterId' => $row['solicitante_id'],
            'requesterName' => $row['solicitante_nombre'],
            'requesterEmail' => $row['solicitante_email'] ?? '',
            'requesterPhone' => $row['solicitante_telefono'] ?? '',
            'branch' => $row['sucursal'],
            'country' => $row['pais'] ?? 'Guatemala',
            'assetCode' => $row['equipo_serie'] ?? '',
            'assignedTechId' => $row['tecnico_id'] ?? '',
            'assignedTechName' => $row['tecnico_nombre'] ?: 'Sin asignar',
            'attachmentBase64' => $row['evidencia_base64'] ?? null,
            'resolutionNotes' => $row['notas_resolucion'] ?? '',
            'comments' => $comments,
            'createdAtDisplay' => $createdAtDisplay,
            'createdAtSql' => $createdAtSql,
            'updatedAtSql' => $row['fecha_actualizacion'] ?? $createdAtSql
        ];
    }
}

