<?php
// ============================================================
//  delete_project.php — Elimina un proyecto y su historial
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// Obtener project_id de diferentes fuentes para mayor robustez
$projectId = 0;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    $projectId = intval($payload['project_id'] ?? $_POST['project_id'] ?? 0);
} else {
    $projectId = intval($_GET['project_id'] ?? 0);
}

if ($projectId <= 0) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Debe enviar project_id']);
    exit;
}

try {
    $connection = createDataBaseConnection();

    // Verificar si el proyecto existe
    $stmt = $connection->prepare("SELECT id FROM proyectos WHERE id = ? LIMIT 1");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$project) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Proyecto no encontrado']);
        exit;
    }

    // Iniciar transacción para garantizar consistencia
    $connection->beginTransaction();

    // Eliminar el proyecto de la tabla proyectos
    $deleteProject = $connection->prepare("DELETE FROM proyectos WHERE id = ?");
    $deleteProject->execute([$projectId]);

    // Eliminar el historial relacionado de la tabla historial
    $deleteHistory = $connection->prepare("DELETE FROM historial WHERE proyecto_id = ?");
    $deleteHistory->execute([$projectId]);

    // Confirmar transacción
    $connection->commit();

    echo json_encode([
        'ok' => true,
        'message' => 'Proyecto eliminado con éxito'
    ]);

} catch (Exception $e) {
    if (isset($connection) && $connection->inTransaction()) {
        $connection->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al eliminar el proyecto',
        'error' => $e->getMessage()
    ]);
}
