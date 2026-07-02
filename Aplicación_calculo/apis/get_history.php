<?php
// ============================================================
//  get_history.php — Endpoint para obtener el historial de escaneos
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
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$limit = 10; // Número de registros por página
$offset = ($page - 1) * $limit;

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
    
    // Asumimos la existencia de una tabla 'historial'
    // La creamos si no existe para evitar errores en pruebas iniciales
    $connection->exec("CREATE TABLE IF NOT EXISTS historial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        proyecto_id INTEGER,
        fecha_escaneo DATETIME DEFAULT CURRENT_TIMESTAMP,
        resultado_ia TEXT
    )");

    $stmt = $connection->prepare("SELECT id, proyecto_id, fecha_escaneo, resultado_ia FROM historial WHERE usuario_id = ? ORDER BY fecha_escaneo DESC LIMIT ? OFFSET ?");
    $stmt->execute([$userId, $limit, $offset]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'page' => $page,
        'history' => $history
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al obtener el historial',
        'error' => $e->getMessage()
    ]);
}
