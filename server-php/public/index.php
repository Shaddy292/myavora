<?php
// Front controller for the AVORA PHP backend. On cPanel every /api/* request
// is rewritten here by .htaccess; static assets and the SPA are served by the
// web server directly and never reach this file.
declare(strict_types=1);

require __DIR__ . '/../src/Config.php';
require __DIR__ . '/../src/Http.php';
require __DIR__ . '/../src/Db.php';
require __DIR__ . '/../src/Store.php';
require __DIR__ . '/../src/Table.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/RateLimit.php';
require __DIR__ . '/../src/EntityApi.php';
require __DIR__ . '/../src/AuthRoutes.php';
require __DIR__ . '/../src/UploadRoutes.php';
require __DIR__ . '/../src/Fn.php';
require __DIR__ . '/../src/FnApi.php';
require __DIR__ . '/../src/Seed.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rtrim($path, '/') ?: '/';

try {
    Db::migrate();
    Seed::run();

    if ($path === '/api/health') {
        Http::json(['ok' => true, 'backend' => 'php']);
        return;
    }

    if (preg_match('#^/api/entities/([A-Za-z][A-Za-z0-9_]*)$#', $path, $m)) {
        EntityApi::handle($method, $m[1]);
        return;
    }

    if (preg_match('#^/api/fn/([a-z][a-z0-9-]*)/([A-Za-z0-9_]+)$#', $path, $m)) {
        if ($method !== 'POST') return Http::json(['error' => 'Method not allowed'], 405);
        FnApi::handle($m[1], $m[2]);
        return;
    }

    if ($path === '/api/auth/login' && $method === 'POST') return AuthRoutes::login();
    if ($path === '/api/auth/register' && $method === 'POST') return AuthRoutes::register();
    if ($path === '/api/auth/logout' && $method === 'POST') return AuthRoutes::logout();
    if ($path === '/api/auth/me' && $method === 'GET') return AuthRoutes::me();
    if ($path === '/api/auth/forgot-password' && $method === 'POST') return AuthRoutes::forgotPassword();
    if ($path === '/api/auth/reset-password' && $method === 'POST') return AuthRoutes::resetPassword();
    if ($path === '/api/auth/providers' && $method === 'GET') return AuthRoutes::providers();
    if ($path === '/api/auth/google' && $method === 'GET') return AuthRoutes::google();
    if ($path === '/api/auth/google/callback' && $method === 'GET') return AuthRoutes::googleCallback();
    if ($path === '/api/users/invite' && $method === 'POST') return AuthRoutes::invite();
    if ($path === '/api/uploads' && $method === 'POST') return UploadRoutes::upload();

    if (preg_match('#^/api/files/([A-Za-z0-9._-]+)$#', $path, $m) && $method === 'GET') {
        return UploadRoutes::file($m[1]);
    }

    Http::json(['error' => 'Not found'], 404);
} catch (Throwable $error) {
    Http::failure($error);
}
