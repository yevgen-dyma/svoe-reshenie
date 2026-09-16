<?php
function admin_key(): string
{
    $envKey = getenv("ADMIN_KEY");
    if ($envKey !== false && $envKey !== "") {
        return $envKey;
    }
    $localConfig = __DIR__ . "/config.local.php";
    if (file_exists($localConfig)) {
        $config = require $localConfig;
        if (is_array($config) && !empty($config["admin_key"])) {
            return (string) $config["admin_key"];
        }
    }
    return "";
}
