<?php
// ============================================================
//  create_project.php — Crea proyecto y calcula materiales
// ============================================================
declare(strict_types=1);
require_once 'cors.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'JSON Invalido']);
    exit;
}

$userId = intval($payload['user_id'] ?? 0);
$nombre = trim((string)($payload['nombre'] ?? 'Proyecto Sin Nombre'));
$tipo = trim((string)($payload['tipo'] ?? 'Residencial'));
$pisos = intval($payload['pisos'] ?? 1);
$material = trim((string)($payload['material'] ?? 'Concreto'));
$area = floatval($payload['area'] ?? 100);

if ($userId <= 0) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Debe enviar user_id']);
    exit;
}

// Fórmulas de cálculo aproximado
$columnas = $pisos * ceil($area / 20); // 1 columna cada 20 m2
$vigas = $columnas * 2;
$muros = $pisos * 4; // 4 muros principales por piso (simplificado)

$concreto = ($area * $pisos * 0.15) + ($columnas * 0.4); // Losas + columnas
$acero = $concreto * 100; // 100kg de acero por m3 de concreto
$peso = ($concreto * 2.4) + ($acero / 1000); // 2.4 ton/m3 concreto

// Costo aproximado
$precioConcreto = 150; // USD/m3
$precioAcero = 1.5; // USD/kg
$precioMadera = 200; // USD/m3

$costo = 0;
if (strtolower($material) === 'acero') {
    $costo = ($concreto * $precioConcreto) + ($acero * $precioAcero * 1.3); // Más caro el acero
} else if (strtolower($material) === 'madera') {
    $costo = ($area * $pisos * 0.2) * $precioMadera;
} else {
    $costo = ($concreto * $precioConcreto) + ($acero * $precioAcero);
}

try {
    $connection = createDataBaseConnection();
    
    // Asegurarse de que la tabla exista con todas las columnas
    $connection->exec("CREATE TABLE IF NOT EXISTS proyectos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        nombre TEXT,
        estado TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        area REAL,
        tipo TEXT,
        pisos INTEGER,
        material TEXT,
        columnas INTEGER,
        vigas INTEGER,
        muros INTEGER,
        concreto REAL,
        acero REAL,
        peso REAL,
        costo REAL
    )");

    // Añadir columnas si la tabla ya existía de antes (SQLite alter table bypass manual)
    $cols = ['tipo'=>'TEXT', 'pisos'=>'INTEGER', 'material'=>'TEXT', 'columnas'=>'INTEGER', 'vigas'=>'INTEGER', 'muros'=>'INTEGER', 'concreto'=>'REAL', 'acero'=>'REAL', 'peso'=>'REAL', 'costo'=>'REAL'];
    foreach($cols as $col => $type) {
        try {
            $connection->exec("ALTER TABLE proyectos ADD COLUMN $col $type");
        } catch(Exception $e) { /* Columna ya existe */ }
    }

    $estado = 'Analizado'; // Estado inicial

    $stmt = $connection->prepare(
        "INSERT INTO proyectos (usuario_id, nombre, estado, area, tipo, pisos, material, columnas, vigas, muros, concreto, acero, peso, costo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $success = $stmt->execute([
        $userId, $nombre, $estado, $area, $tipo, $pisos, $material, 
        $columnas, $vigas, $muros, $concreto, $acero, $peso, $costo
    ]);

    if ($success) {
        $projectId = $connection->lastInsertId();
        
        // Registrar en historial
        $connection->exec("CREATE TABLE IF NOT EXISTS historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            proyecto_id INTEGER,
            fecha_escaneo DATETIME DEFAULT CURRENT_TIMESTAMP,
            resultado_ia TEXT
        )");
        
        $histStmt = $connection->prepare("INSERT INTO historial (usuario_id, proyecto_id, resultado_ia) VALUES (?, ?, ?)");
        $histStmt->execute([$userId, $projectId, "Escaneo procesado correctamente"]);

        echo json_encode([
            'ok' => true,
            'project_id' => $projectId,
            'message' => 'Proyecto guardado con éxito'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'No se pudo guardar el proyecto']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Error en el servidor',
        'error' => $e->getMessage()
    ]);
}
