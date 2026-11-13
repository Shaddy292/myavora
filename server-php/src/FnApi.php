<?php
// Server-function port for the SPA build: POST /api/fn/{module}/{name} with
// JSON { data } → { result }. Function ports live in src/fns/, one class per
// frontend module; each registry entry marks whether a session is required.
declare(strict_types=1);

final class FnApi
{
    public static function handle(string $module, string $name): void
    {
        $entry = self::registry()["{$module}/{$name}"] ?? null;
        if (!$entry) {
            Http::json(['error' => 'Unknown function'], 404);
            return;
        }
        try {
            $user = Auth::sessionUser();
            if ($entry['auth'] && !$user) {
                Http::json(['error' => 'Unauthorized'], 401);
                return;
            }
            $body = Http::readJsonBody();
            $data = is_array($body['data'] ?? null) ? $body['data'] : [];
            $result = ($entry['run'])($data, $user);
            Http::json(['result' => $result]);
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    private static function registry(): array
    {
        static $registry = null;
        if ($registry !== null) return $registry;
        $registry = [];
        foreach (glob(__DIR__ . '/fns/*.php') ?: [] as $file) {
            require_once $file;
            $class = basename($file, '.php');
            if (class_exists($class) && method_exists($class, 'registry')) {
                $registry = array_merge($registry, $class::registry());
            }
        }
        return $registry;
    }

    private function __construct() {}
}
