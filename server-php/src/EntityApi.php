<?php
// The PHP port of src/routes/api/entities.$entity.js. Every call requires a
// signed-in session; personal tables are narrowed to the session owner and the
// shared tables (User, RiderProfile, Order, Refund, SupportTicket) are filtered
// by ownership or admin role — identical rules to the Node backend.
declare(strict_types=1);

final class EntityApi
{
    private const ENTITY_NAME = '/^[A-Za-z][A-Za-z0-9_]*$/';
    private const SECRET_FIELDS = ['password_hash', 'password', 'reset_token', 'reset_token_hash', 'reset_token_expires'];
    private const EMAIL_FIELD = [
        'User' => 'email',
        'RiderProfile' => 'user_email',
        'Order' => 'customer_email',
        'Refund' => 'customer_email',
        'SupportTicket' => 'customer_email',
    ];

    public static function handle(string $method, string $entity): void
    {
        $user = Auth::sessionUser();
        if (!$user) {
            Http::json(['error' => 'Unauthorized'], 401);
            return;
        }
        if (!preg_match(self::ENTITY_NAME, $entity)) {
            Http::json(['error' => 'Unknown table'], 400);
            return;
        }
        try {
            match ($method) {
                'GET' => self::get($entity, $user),
                'POST' => self::post($entity, $user),
                'PATCH' => self::patch($entity, $user),
                'DELETE' => self::delete($entity, $user),
                default => Http::json(['error' => 'Method not allowed'], 405),
            };
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    // --- GET /api/entities/{Entity} ---------------------------------------

    private static function get(string $entity, array $user): void
    {
        $query = self::parseJson($_GET['query'] ?? '', []);
        $table = Table::for($entity, $user);

        $id = $_GET['id'] ?? null;
        if ($id !== null) {
            try {
                $row = $table->get((string) $id);
            } catch (Throwable) {
                $row = null;
            }
            if (!$row || !self::visibleRows($entity, [$row], $user)) {
                Http::json(['error' => 'Not found'], 404);
                return;
            }
            Http::json(self::clean($row));
            return;
        }

        $sort = self::parseJson($_GET['sort'] ?? '', null);
        $rows = self::visibleRows($entity, $table->filter($query, ['sort' => $sort]), $user);
        if (($_GET['count'] ?? '') === '1') {
            Http::json(['count' => count($rows)]);
            return;
        }
        $skip = self::number($_GET['skip'] ?? null) ?? 0;
        $limit = self::number($_GET['limit'] ?? null);
        $windowed = $limit === null ? array_slice($rows, (int) $skip) : array_slice($rows, (int) $skip, (int) $limit);
        Http::json(array_map([self::class, 'clean'], $windowed));
    }

    // --- POST /api/entities/{Entity} --------------------------------------

    private static function post(string $entity, array $user): void
    {
        $body = Http::readJsonBody();
        $op = $_GET['op'] ?? null;
        $table = Table::for($entity, $user);

        if ($op === 'update-many') {
            if ($entity === 'User' && $user['role'] !== 'admin') self::forbid();
            Http::json(array_map([self::class, 'clean'], $table->updateMany($body['query'] ?? [], $body['data'] ?? [])));
            return;
        }
        if ($op === 'delete-many') {
            if ($entity === 'User' && $user['role'] !== 'admin') self::forbid();
            Http::json($table->deleteMany($body['query'] ?? []));
            return;
        }
        if ($user['role'] !== 'admin' && $entity === 'User') self::forbid();
        $field = self::EMAIL_FIELD[$entity] ?? null;
        $data = $field ? array_merge($body, [$field => $user['email']]) : $body;
        Http::json(self::clean($table->create($data)), 201);
    }

    // --- PATCH / DELETE /api/entities/{Entity}?id=... ---------------------

    private static function patch(string $entity, array $user): void
    {
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'An id is required'], 400);
            return;
        }
        $table = Table::for($entity, $user);
        $row = $table->get($id);
        self::assertCanWrite($entity, $row, $user);
        Http::json(self::clean(Store::update($entity, $id, Http::readJsonBody())));
    }

    private static function delete(string $entity, array $user): void
    {
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') {
            Http::json(['error' => 'An id is required'], 400);
            return;
        }
        $table = Table::for($entity, $user);
        $row = $table->get($id);
        self::assertCanWrite($entity, $row, $user);
        Http::json($table->delete($id));
    }

    // --- visibility / write rules (mirror entities.$entity.js) ------------

    private static function clean(array $row): array
    {
        foreach (self::SECRET_FIELDS as $field) unset($row[$field]);
        return $row;
    }

    /** @return string[] store ids owned by the user */
    private static function ownedStores(array $user): array
    {
        return array_column(Store::filter('Store', ['owner_email' => $user['email']]), 'id');
    }

    private static function canRead(string $entity, array $row, array $user, array $stores): bool
    {
        if ($user['role'] === 'admin') return true;
        if ($entity === 'User') return ($row['email'] ?? null) === $user['email'];
        if ($entity === 'RiderProfile') return ($row['user_email'] ?? null) === $user['email'];
        if ($entity === 'Order') {
            return ($row['customer_email'] ?? null) === $user['email']
                || ($row['rider_email'] ?? null) === $user['email']
                || in_array($row['store_id'] ?? null, $stores, true);
        }
        if ($entity === 'Refund') {
            return ($row['customer_email'] ?? null) === $user['email'] || ($row['user_email'] ?? null) === $user['email'];
        }
        if ($entity === 'SupportTicket') {
            return ($row['user_email'] ?? null) === $user['email'] || ($row['customer_email'] ?? null) === $user['email'];
        }
        return true;
    }

    private static function visibleRows(string $entity, array $rows, array $user): array
    {
        if ($user['role'] === 'admin') return $rows;
        $stores = $entity === 'Order' ? self::ownedStores($user) : [];
        return array_values(array_filter($rows, fn ($row) => self::canRead($entity, $row, $user, $stores)));
    }

    private static function assertCanWrite(string $entity, array $row, array $user): void
    {
        if ($user['role'] === 'admin') return;
        if ($entity === 'User') self::forbid();
        $field = self::EMAIL_FIELD[$entity] ?? null;
        if ($field && ($row[$field] ?? null) === $user['email']) return;
        if ($entity === 'Order' && isset($row['store_id']) && in_array($row['store_id'], self::ownedStores($user), true)) return;
        if (!$field) return;
        self::forbid();
    }

    private static function forbid(): never
    {
        throw new RuntimeException('Forbidden', 403);
    }

    // --- helpers ----------------------------------------------------------

    private static function parseJson(mixed $value, mixed $fallback): mixed
    {
        if (!$value) return $fallback;
        $parsed = json_decode((string) $value, true);
        return $parsed === null && json_last_error() !== JSON_ERROR_NONE ? $fallback : $parsed;
    }

    private static function number(mixed $value): int|float|null
    {
        if ($value === null || $value === '') return null;
        if (!is_numeric($value)) return null;
        $parsed = $value + 0;
        return is_finite($parsed) ? $parsed : null;
    }

    private function __construct() {}
}
