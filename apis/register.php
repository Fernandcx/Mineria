<?php
// ============================================================
//  register.php — Endpoint para Registro de Usuarios
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'message' => 'Method Not Allowed'
    ]);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload) {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'message' => 'JSON Invalido'
    ]);
    exit;
}

$username = trim((string) ($payload['username'] ?? ''));
$password = ((string) ($payload['password'] ?? ''));
$nombre = trim((string) ($payload['nombre'] ?? ''));

if ($username === '' || $password === '' || $nombre === '') {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Debe enviar nombre, usuario y contraseña'
    ]);
    exit;
}

$connection = createDataBaseConnection();

// Check if user already exists
$stmt = $connection->prepare("SELECT id FROM usuarios WHERE usuario = ? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Internal Server Error']);
    exit;
}

$stmt->execute([$username]);
if ($stmt->fetch()) {
    http_response_code(409); // Conflict
    echo json_encode([
        'ok' => false,
        'message' => 'El nombre de usuario ya está registrado'
    ]);
    exit;
}

// Hash the password securely
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);
$rol = 'usuario'; // Default role

$insertStmt = $connection->prepare(
    "INSERT INTO usuarios (usuario, nombre, contrasena, rol, activo) VALUES (?, ?, ?, ?, 1)"
);

if (!$insertStmt) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Internal Server Error']);
    exit;
}

$success = $insertStmt->execute([$username, $nombre, $hashedPassword, $rol]);

if ($success) {
    echo json_encode([
        'ok' => true,
        'message' => 'Usuario registrado exitosamente',
        'user' => [
            'id' => $connection->lastInsertId(),
            'nombre' => $nombre,
            'usuario' => $username,
            'rol' => $rol
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error al registrar el usuario'
    ]);
}

$stmt = null;
$insertStmt = null;
$connection = null;
