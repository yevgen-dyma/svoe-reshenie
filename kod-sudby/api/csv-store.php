<?php
declare(strict_types=1);

const CSV_COLUMNS = ["id", "last_name", "first_name", "patronymic", "phone", "email", "created_at"];

function csv_path(): string
{
    $dataDir = __DIR__ . "/data";
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0770, true);
    }
    return $dataDir . "/registrations.csv";
}

function csv_ensure_file(): string
{
    $path = csv_path();
    if (!file_exists($path)) {
        $fh = fopen($path, "x");
        if ($fh !== false) {
            fputcsv($fh, CSV_COLUMNS);
            fclose($fh);
        }
    }
    return $path;
}

/** Reads all registrations as an array of associative rows. */
function csv_read_all(): array
{
    $path = csv_ensure_file();
    $fh = fopen($path, "r");
    if ($fh === false) {
        return [];
    }
    $header = fgetcsv($fh);
    $rows = [];
    if ($header !== false) {
        while (($cols = fgetcsv($fh)) !== false) {
            if ($cols === [null] || $cols === false) {
                continue;
            }
            $rec = array_combine($header, array_pad($cols, count($header), ""));
            $rec["id"] = (int) $rec["id"];
            $rows[] = $rec;
        }
    }
    fclose($fh);
    return $rows;
}

/**
 * Appends a new registration under an exclusive file lock (safe for
 * concurrent PHP-FPM/Apache workers) and returns the assigned id.
 */
function csv_append(string $lastName, string $firstName, string $patronymic, string $phone, string $email): int
{
    $path = csv_ensure_file();
    $fh = fopen($path, "c+");
    if ($fh === false) {
        throw new RuntimeException("Не удалось открыть файл регистраций");
    }

    if (!flock($fh, LOCK_EX)) {
        fclose($fh);
        throw new RuntimeException("Не удалось заблокировать файл регистраций");
    }

    $maxId = 0;
    rewind($fh);
    $header = fgetcsv($fh);
    if ($header !== false) {
        while (($cols = fgetcsv($fh)) !== false) {
            if (isset($cols[0]) && is_numeric($cols[0])) {
                $maxId = max($maxId, (int) $cols[0]);
            }
        }
    }
    $id = $maxId + 1;

    fseek($fh, 0, SEEK_END);
    fputcsv($fh, [
        $id,
        $lastName,
        $firstName,
        $patronymic,
        $phone,
        $email,
        gmdate("Y-m-d\TH:i:s\Z"),
    ]);

    flock($fh, LOCK_UN);
    fclose($fh);

    return $id;
}
