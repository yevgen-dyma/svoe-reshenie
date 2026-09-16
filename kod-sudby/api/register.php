<?php
declare(strict_types=1);

require __DIR__ . "/csv-store.php";

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method Not Allowed"], JSON_UNESCAPED_UNICODE);
    exit;
}

function is_valid_email(string $v): bool
{
    return (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $v);
}

function digits_only(string $v): string
{
    return preg_replace('/\D/', '', $v) ?? "";
}

$raw = file_get_contents("php://input");
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Некорректный JSON"], JSON_UNESCAPED_UNICODE);
    exit;
}

$lastName = trim((string) ($payload["lastName"] ?? ""));
$firstName = trim((string) ($payload["firstName"] ?? ""));
$patronymic = trim((string) ($payload["patronymic"] ?? ""));
$phone = trim((string) ($payload["phone"] ?? ""));
$email = trim((string) ($payload["email"] ?? ""));

$errors = [];
if ($lastName === "") $errors["lastName"] = "Укажи фамилию";
if ($firstName === "") $errors["firstName"] = "Укажи имя";
if (strlen(digits_only($phone)) < 7) $errors["phone"] = "Укажи корректный телефон";
if (!is_valid_email($email)) $errors["email"] = "Укажи корректный email";

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "errors" => $errors], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $id = csv_append($lastName, $firstName, $patronymic, $phone, $email);
    http_response_code(201);
    echo json_encode(["ok" => true, "id" => $id], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Не удалось сохранить запись"], JSON_UNESCAPED_UNICODE);
}
