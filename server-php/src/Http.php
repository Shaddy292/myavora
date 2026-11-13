<?php
// Response helpers shared by the PHP routes.
declare(strict_types=1);

final class Http
{
    // The baseline headers from security.server.js, applied to every response.
    public const SECURITY_HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
    ];

    public static function json(mixed $data, int $status = 200, array $cookies = [], array $headers = []): void
    {
        self::respond($status, array_merge(['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'], $headers), $cookies);
        echo json_encode($data, JSON_UNESCAPED_SLASHES);
    }

    // A 302 that can also set cookies (PHP's header() handles multiple
    // Set-Cookie lines, unlike a single Location header trick).
    public static function redirect(string $location, int $status = 302, array $cookies = []): void
    {
        self::respond($status, ['Location' => $location], $cookies);
    }

    public static function file(string $path, string $contentType, string $cacheControl): void
    {
        self::respond(200, ['Content-Type' => $contentType, 'Cache-Control' => $cacheControl]);
        readfile($path);
    }

    public static function respond(int $status, array $headers = [], array $cookies = []): void
    {
        if (headers_sent()) return;
        http_response_code($status);
        foreach (array_merge(self::SECURITY_HEADERS, $headers) as $name => $value) {
            header("{$name}: {$value}");
        }
        foreach ($cookies as $cookie) {
            header('Set-Cookie: ' . $cookie, false);
        }
    }

    // failure() from http.server.js: log 5xx, generic message to the caller.
    public static function failure(Throwable $error): void
    {
        $status = (int) ($error->getCode() >= 400 && $error->getCode() < 600 ? $error->getCode() : 500);
        if ($status >= 500) {
            error_log('[avora-php] request failed: ' . $error->getMessage());
        }
        $message = $status >= 500 ? 'Internal server error' : ($error->getMessage() || 'Request failed');
        self::json(['error' => $message], $status);
    }

    public static function clientIp(): string
    {
        foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP'] as $key) {
            $value = $_SERVER[$key] ?? '';
            if ($value) return trim(explode(',', $value)[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    public static function readJsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $parsed = json_decode($raw, true);
        return is_array($parsed) ? $parsed : [];
    }

    private function __construct() {}
}
