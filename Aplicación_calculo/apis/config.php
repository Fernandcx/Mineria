<?php
declare(strict_types=1);

function createDataBaseConnection(): PDO
{
    try {
        $connection = new PDO('sqlite:' . __DIR__ . '/mineria.db');
        $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $connection;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'message' => 'No se pudo conectar a la base de datos'
        ]);
        exit;
    }
}