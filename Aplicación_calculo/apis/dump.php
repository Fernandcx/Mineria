<?php
try {
    $db = new PDO('sqlite:mineria.db');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
    foreach ($tables as $t) {
        $tableName = $t['name'];
        echo "Table: $tableName\n";
        $res = $db->query("SELECT * FROM $tableName");
        $rows = $res->fetchAll(PDO::FETCH_ASSOC);
        print_r($rows);
    }
} catch (Exception $e) {
    echo $e->getMessage();
}
