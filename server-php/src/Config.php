<?php
// Process-wide settings for the PHP backend, overridable through the
// environment (cPanel "Setup Node.js App"-style env vars are NOT needed —
// set these in the PHP ini, .htaccess SetEnv, or the host's env tool).
declare(strict_types=1);

final class Config
{
    private static ?array $cache = null;

    public static function get(string $key): mixed
    {
        self::$cache ??= [
            // 'mysql' (production) or 'sqlite' for local smoke tests. SQLite
            // needs no server, so the PHP backend can be exercised on a
            // workstation; cPanel deployments keep the MySQL default.
            'dbDriver' => strtolower(getenv('AVORA_DB_DRIVER') ?: 'mysql'),
            'dbFile' => getenv('AVORA_DB_FILE') ?: (__DIR__ . '/../.sqlite/avora.sqlite'),
            'dbHost' => getenv('AVORA_DB_HOST') ?: 'localhost',
            'dbName' => getenv('AVORA_DB_NAME') ?: '',
            'dbUser' => getenv('AVORA_DB_USER') ?: '',
            'dbPass' => getenv('AVORA_DB_PASS') ?: '',
            // Signs session cookies and reset tokens. REQUIRED in production.
            'secret' => getenv('AVORA_SECRET') ?: '',
            // Seed the demo dataset (stores, menus, demo admin) on first run.
            'demo' => self::bool(getenv('AVORA_DEMO'), true),
            'demoPassword' => getenv('AVORA_DEMO_PASSWORD') ?: 'demo1234',
            'secureCookies' => self::bool(getenv('AVORA_SECURE_COOKIES'), false),
            'googleClientId' => getenv('AVORA_GOOGLE_CLIENT_ID') ?: '',
            'googleClientSecret' => getenv('AVORA_GOOGLE_CLIENT_SECRET') ?: '',
            // Where uploaded files live; must be writable by PHP.
            'uploadDir' => getenv('AVORA_UPLOAD_DIR') ?: (__DIR__ . '/../uploads'),
        ];
        return self::$cache[$key] ?? null;
    }

    private static function bool(string|false $value, bool $fallback): bool
    {
        if ($value === false || $value === '') return $fallback;
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    private function __construct() {}
}
