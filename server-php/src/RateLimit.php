<?php
// Fixed-window rate limiter, mirroring rate-limit.server.js but stored in
// MySQL (PHP-FPM has no shared in-memory state between workers).
declare(strict_types=1);

final class RateLimit
{
    // Returns an error response array to send, or null when under the limit.
    public static function check(string $scope, int $limit, int $windowMs): ?array
    {
        $ip = Http::clientIp();
        $window = (int) floor((microtime(true) * 1000) / $windowMs);
        $id = substr("{$scope}:{$ip}:{$window}", 0, 190);
        $resetAt = ($window + 1) * $windowMs / 1000;

        $pdo = Db::pdo();
        $pdo->prepare('DELETE FROM rate_limits WHERE reset_at < ?')->execute([microtime(true)]);
        if (Db::driver() === 'sqlite') {
            $pdo->prepare(
                'INSERT INTO rate_limits (id, hits, reset_at) VALUES (?, 1, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   hits = CASE WHEN rate_limits.reset_at < excluded.reset_at THEN 1 ELSE rate_limits.hits + 1 END,
                   reset_at = excluded.reset_at'
            )->execute([$id, $resetAt]);
        } else {
            $pdo->prepare(
                'INSERT INTO rate_limits (id, hits, reset_at) VALUES (?, 1, ?)
                 ON DUPLICATE KEY UPDATE hits = IF(reset_at < VALUES(reset_at), 1, hits + 1), reset_at = VALUES(reset_at)'
            )->execute([$id, $resetAt]);
        }
        $hits = (int) $pdo->query('SELECT hits FROM rate_limits WHERE id = ' . $pdo->quote($id))->fetchColumn();

        if ($hits <= $limit) return null;
        return [
            'status' => 429,
            'headers' => ['Retry-After' => (string) max(1, (int) ceil($resetAt - time()))],
            'body' => ['error' => 'Too many attempts. Try again in a few minutes.'],
        ];
    }

    private function __construct() {}
}
