<?php
/**
 * API REST Backend PHP + MySQL para Sistema de Tickets
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$pdo = Database::getConnection();
if (!$pdo) {
    echo json_encode([
        'ok' => false,
        'mode' => 'local_fallback',
        'message' => 'MySQL no disponible, operando en almacenamiento local: ' . Database::getLastError()
    ]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

try {
    // 1. BOOTSTRAP: Carga inicial de categorías, usuarios y tickets desde MySQL
    if ($method === 'GET' && $action === 'bootstrap') {
        $catRows = $pdo->query("SELECT id, nombre AS name, sla_horas AS slaHours, icono AS icon FROM categorias ORDER BY nombre ASC")->fetchAll();
        foreach ($catRows as &$c) {
            $c['slaHours'] = (int) $c['slaHours'];
        }

        $userRows = $pdo->query("SELECT id, nombre AS name, rol AS role, sucursal AS branch, pais AS country, email, telefono AS phone, pin, bloqueado AS blocked FROM usuarios ORDER BY id ASC")->fetchAll();
        foreach ($userRows as &$u) {
            $u['blocked'] = !empty($u['blocked']);
        }

        $ticketRows = $pdo->query("SELECT * FROM tickets ORDER BY fecha_creacion DESC")->fetchAll();
        $tickets = array_map([Database::class, 'mapTicketRow'], $ticketRows);

        echo json_encode([
            'ok' => true,
            'mode' => 'mysql_live',
            'phpVersion' => PHP_VERSION,
            'serverTime' => date('Y-m-d H:i:s'),
            'categories' => $catRows,
            'users' => $userRows,
            'tickets' => $tickets
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. LIST: Obtener todos los tickets sincronizados en MySQL
    if ($method === 'GET' && $action === 'list') {
        $stmt = $pdo->query("SELECT * FROM tickets ORDER BY fecha_creacion DESC");
        $rows = $stmt->fetchAll();
        $tickets = array_map([Database::class, 'mapTicketRow'], $rows);

        echo json_encode([
            'ok' => true,
            'mode' => 'mysql_live',
            'tickets' => $tickets
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 3. OPERACIONES POST (Crear, Actualizar, Cambio Rápido de Estado, Eliminar)
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new Exception('Datos JSON inválidos');
        }

        if ($action === 'save') {
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
                ON DUPLICATE KEY UPDATE
                    titulo = VALUES(titulo),
                    descripcion = VALUES(descripcion),
                    categoria_id = VALUES(categoria_id),
                    categoria_nombre = VALUES(categoria_nombre),
                    prioridad = VALUES(prioridad),
                    estado = VALUES(estado),
                    sucursal = VALUES(sucursal),
                    pais = VALUES(pais),
                    equipo_serie = VALUES(equipo_serie),
                    tecnico_id = VALUES(tecnico_id),
                    tecnico_nombre = VALUES(tecnico_nombre),
                    evidencia_base64 = VALUES(evidencia_base64),
                    notas_resolucion = VALUES(notas_resolucion),
                    comentarios_json = VALUES(comentarios_json),
                    fecha_actualizacion = VALUES(fecha_actualizacion)
            ");

            $stmt->execute([
                ':id' => $input['id'],
                ':codigo' => $input['code'],
                ':titulo' => $input['title'],
                ':descripcion' => $input['description'],
                ':categoria_id' => $input['categoryId'],
                ':categoria_nombre' => $input['categoryName'],
                ':prioridad' => $input['priority'],
                ':estado' => $input['status'],
                ':solicitante_id' => $input['requesterId'],
                ':solicitante_nombre' => $input['requesterName'],
                ':solicitante_email' => $input['requesterEmail'] ?? '',
                ':solicitante_telefono' => $input['requesterPhone'] ?? '',
                ':sucursal' => $input['branch'],
                ':pais' => $input['country'] ?? 'Guatemala',
                ':equipo_serie' => $input['assetCode'] ?? '',
                ':tecnico_id' => $input['assignedTechId'] ?? '',
                ':tecnico_nombre' => $input['assignedTechName'] ?? 'Sin asignar',
                ':evidencia_base64' => $input['attachmentBase64'] ?? null,
                ':notas_resolucion' => $input['resolutionNotes'] ?? '',
                ':comentarios_json' => json_encode($input['comments'] ?? [], JSON_UNESCAPED_UNICODE),
                ':fecha_creacion' => $input['createdAtSql'] ?? date('Y-m-d H:i:s'),
                ':fecha_actualizacion' => date('Y-m-d H:i:s')
            ]);

            echo json_encode([
                'ok' => true,
                'mode' => 'mysql_live',
                'message' => 'Ticket sincronizado en MySQL correctamente'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'delete' && !empty($input['id'])) {
            $stmt = $pdo->prepare("DELETE FROM tickets WHERE id = :id");
            $stmt->execute([':id' => $input['id']]);
            echo json_encode([
                'ok' => true,
                'mode' => 'mysql_live',
                'message' => 'Ticket eliminado de MySQL'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'save_user') {
            $stmt = $pdo->prepare("
                INSERT INTO usuarios (id, nombre, rol, sucursal, pais, email, telefono, pin, bloqueado)
                VALUES (:id, :nombre, :rol, :sucursal, :pais, :email, :telefono, :pin, :bloqueado)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    rol = VALUES(rol),
                    sucursal = VALUES(sucursal),
                    pais = VALUES(pais),
                    email = VALUES(email),
                    telefono = VALUES(telefono),
                    pin = VALUES(pin),
                    bloqueado = VALUES(bloqueado)
            ");
            $stmt->execute([
                ':id' => $input['id'],
                ':nombre' => $input['name'],
                ':rol' => $input['role'] ?? 'solicitante',
                ':sucursal' => $input['branch'],
                ':pais' => $input['country'] ?? 'Guatemala',
                ':email' => $input['email'] ?? '',
                ':telefono' => $input['phone'] ?? '',
                ':pin' => $input['pin'] ?? '1',
                ':bloqueado' => !empty($input['blocked']) ? 1 : 0
            ]);

            echo json_encode([
                'ok' => true,
                'mode' => 'mysql_live',
                'message' => 'Usuario guardado correctamente'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'delete_user' && !empty($input['id'])) {
            $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = :id");
            $stmt->execute([':id' => $input['id']]);
            echo json_encode([
                'ok' => true,
                'mode' => 'mysql_live',
                'message' => 'Usuario eliminado correctamente'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    echo json_encode(['ok' => false, 'message' => 'Acción no reconocida']);
} catch (Exception $ex) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => $ex->getMessage()]);
}
