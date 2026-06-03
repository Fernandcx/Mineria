<?php
// ============================================================
//  get_project_details.php — Obtiene todos los cálculos de un proyecto
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$projectId = isset($_GET['project_id']) ? intval($_GET['project_id']) : 0;

if ($projectId <= 0) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Debe enviar project_id']);
    exit;
}

try {
    $connection = createDataBaseConnection();

    $stmt = $connection->prepare("SELECT * FROM proyectos WHERE id = ? LIMIT 1");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($project) {
        echo json_encode([
            'ok' => true,
            'project' => $project
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Proyecto no encontrado']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al obtener proyecto',
        'error' => $e->getMessage()
    ]);
}
