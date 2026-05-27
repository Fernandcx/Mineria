<?php
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=> false, 'message'=> 'Method Not Allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload){
    http_response_code(405);
    echo json_encode(['ok'=> false, 'message'=> 'JSON Invalido']);
    exit;
}

$username = trim((string)($payload['username'] ?? ''));
$newPassword = ((string)($payload['newPassword'] ?? ''));

if ($username === '' || $newPassword === '') {
    http_response_code(422);
    echo json_encode(['ok'=> false, 'message'=> 'Faltan datos']);
    exit;
}

$connection = createDataBaseConnection();

$stmt = $connection->prepare("SELECT id FROM usuarios WHERE usuario = ? LIMIT 1");
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    http_response_code(404);
    echo json_encode(['ok'=> false, 'message'=> 'Usuario no encontrado']);
    exit;
}

// Generate hash
$hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

$updateStmt = $connection->prepare("UPDATE usuarios SET contrasena = ? WHERE id = ?");
$success = $updateStmt->execute([$hashedPassword, $user['id']]);

if ($success) {
    echo json_encode(['ok'=> true, 'message'=> 'Contraseña actualizada correctamente']);
} else {
    http_response_code(500);
    echo json_encode(['ok'=> false, 'message'=> 'No se pudo actualizar la contraseña']);
}

$stmt = null;
$updateStmt = null;
$connection = null;
