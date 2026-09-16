<?php
declare(strict_types=1);

require __DIR__ . "/csv-store.php";
require __DIR__ . "/config.php";

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method Not Allowed"]);
    exit;
}

$key = admin_key();
$given = $_GET["key"] ?? "";
if ($key === "" || !hash_equals($key, (string) $given)) {
    http_response_code(401);
    echo json_encode(["ok" => false, "error" => "Unauthorized"]);
    exit;
}

$rows = csv_read_all();
usort($rows, fn($a, $b) => $b["id"] <=> $a["id"]);

echo json_encode(["ok" => true, "count" => count($rows), "rows" => $rows], JSON_UNESCAPED_UNICODE);
