<?php
// ============================================================
//  get_user.php — Endpoint para obtener el perfil de usuario
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'message' => 'Method Not Allowed'
    ]);
    exit;
}

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Debe enviar el parámetro user_id'
    ]);
    exit;
}

try {
    $connection = createDataBaseConnection();

    $stmt = $connection->prepare("SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'ok' => false,
            'message' => 'Usuario no encontrado'
        ]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'user' => [
            'id' => intval($user['id']),
            'usuario' => $user['usuario'],
            'nombre' => $user['nombre'],
            'rol' => $user['rol'],
            'activo' => intval($user['activo'])
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al obtener usuario',
        'error' => $e->getMessage()
    ]);
}
