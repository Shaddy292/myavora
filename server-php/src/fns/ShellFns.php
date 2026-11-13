<?php
// Port of src/lib/server-fns.js and session-fns.js (public shell reads).
declare(strict_types=1);

final class ShellFns
{
    public static function registry(): array
    {
        return [
            'server/getServerInfo' => ['auth' => false, 'run' => [self::class, 'getServerInfo']],
            'session/visitor' => ['auth' => false, 'run' => [self::class, 'visitor']],
        ];
    }

    public static function getServerInfo(array $data, ?array $user): array
    {
        return ['renderedAt' => Store::now()];
    }

    public static function visitor(array $data, ?array $user): ?array
    {
        return $user;
    }

    private function __construct() {}
}
