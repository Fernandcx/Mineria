<?php
// ============================================================
//  get_projects.php — Endpoint para obtener la lista de proyectos
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
    
    // Asumimos la existencia de una tabla 'proyectos'
    // La creamos si no existe para evitar errores en pruebas iniciales
    $connection->exec("CREATE TABLE IF NOT EXISTS proyectos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        nombre TEXT,
        estado TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        area REAL
    )");

    $stmt = $connection->prepare("SELECT id, nombre, estado, fecha, area FROM proyectos WHERE usuario_id = ? ORDER BY fecha DESC");
    $stmt->execute([$userId]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'projects' => $projects
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al obtener los proyectos',
        'error' => $e->getMessage()
    ]);
}
