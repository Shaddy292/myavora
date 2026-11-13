<?php
// MySQL connection + schema. Rows are stored as JSON documents in a single
// table, mirroring the Node JSON store's semantics one to one (the Store
// class applies the query/patch operators in PHP).
declare(strict_types=1);

final class Db
{
    private static ?PDO $pdo = null;

    public static function driver(): string
    {
        return (string) Config::get('dbDriver') === 'sqlite' ? 'sqlite' : 'mysql';
    }

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        if (self::driver() === 'sqlite') {
            $file = (string) Config::get('dbFile');
            $dir = dirname($file);
            if (!is_dir($dir)) mkdir($dir, 0777, true);
            self::$pdo = new PDO('sqlite:' . $file, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            self::$pdo->exec('PRAGMA journal_mode = WAL');
            self::$pdo->exec('PRAGMA busy_timeout = 5000');
            return self::$pdo;
        }
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', Config::get('dbHost'), Config::get('dbName'));
        self::$pdo = new PDO($dsn, (string) Config::get('dbUser'), (string) Config::get('dbPass'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return self::$pdo;
    }

    public static function migrate(): void
    {
        $pdo = self::pdo();
        if (self::driver() === 'sqlite') {
            $pdo->exec(
                'CREATE TABLE IF NOT EXISTS entities (
                    entity TEXT NOT NULL,
                    id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    row_order REAL NOT NULL DEFAULT 0,
                    PRIMARY KEY (entity, id)
                )'
            );
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_entity_order ON entities (entity, row_order)');
            $pdo->exec(
                'CREATE TABLE IF NOT EXISTS rate_limits (
                    id TEXT NOT NULL PRIMARY KEY,
                    hits INTEGER NOT NULL,
                    reset_at REAL NOT NULL
                )'
            );
            return;
        }
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS entities (
                entity VARCHAR(64) NOT NULL,
                id VARCHAR(128) NOT NULL,
                data MEDIUMTEXT NOT NULL,
                created_at DOUBLE NOT NULL,
                updated_at DOUBLE NOT NULL,
                row_order DOUBLE NOT NULL DEFAULT 0,
                PRIMARY KEY (entity, id),
                KEY idx_entity_order (entity, row_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        // Fixed-window rate limiting that survives PHP-FPM worker restarts.
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS rate_limits (
                id VARCHAR(190) NOT NULL PRIMARY KEY,
                hits INT NOT NULL,
                reset_at DOUBLE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    private function __construct() {}
}
