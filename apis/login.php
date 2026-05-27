<?php
// ============================================================
//  cors.php — Cabeceras CORS para Kishi
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

function isSha1Hash( string $string): bool {
    return strlen($string) === 40 && ctype_xdigit($string);
}

function isValidPassword(string $plainPassword, string $storedPassword): bool {
    if ($storedPassword === ''){
        return false;
    }
    if ($plainPassword === $storedPassword) {
        return true;
    }
    if (isSha1Hash($storedPassword)){
        return hash_equals(strtolower($storedPassword), sha1($plainPassword));
    }
    return password_verify($plainPassword, $storedPassword);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'ok'=> false,
        'exists'=> false,
        'message'=> 'Method Not Allowed'
        ]);
    exit;
}
$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload){
    http_response_code(405);
    echo json_encode([
        'ok'=> false,
        'exists'=> false,
        'message'=> 'JSON Invalido'
        ]);
    exit;
}

$username = trim((string)($payload['username'] ?? ''));
$password = ((string)($payload['password'] ??''));
if ($username === ''|| $password === '') {
    http_response_code(422);
    echo json_encode([
        'ok'=> false,
        'exists'=> false,
        'message'=> 'Debe enviar username y password'
        ]);
    exit;
}
$connection = createDataBaseConnection();
$stmt = $connection->prepare(
    "SELECT id, usuario, nombre, contrasena, rol, activo 
    FROM usuarios 
    WHERE usuario = ?
    LIMIT 1"
);

if (!$stmt){
    http_response_code(500);
    echo json_encode([
        'ok'=> false,
        'exists'=> false,
        'message'=> 'Internal Server Error'
        ]);
    exit;
}

$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user){
    http_response_code(404);
    echo json_encode([
        'ok'=> false,
        'exists'=> false,
        'message'=> 'Usuario no encontrado'
        ]);
    exit;
}


if (intval($user['activo'] ?? 0) !== 1) {
    http_response_code(403);
    echo json_encode([
        'ok'=> false,
        'exists'=> true,
        'message'=> 'Usuario inactivo'
        ]);
    exit;
}


if (!isValidPassword($password, (string)$user['contrasena'])) {
    http_response_code(401);
    echo json_encode([
        'ok'=> false,
        'exists'=> true,
        'message'=> 'Contraseña incorrecta'
        ]);
        $stmt = null;
        $connection = null;
    exit;
}

echo json_encode([
    'ok'=> true,
    'exists'=> true,
    'message'=> 'Usuario encontrado',
    'user'=> [
        'id'=> intval($user['id']),
        'nombre'=> $user['nombre'],
        'usuario' => $user['usuario'],
        'rol'=> $user['rol']
    ]
]);
$stmt = null;
$connection = null;
