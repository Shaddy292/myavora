<?php
// The MySQL-backed equivalent of src/server/store.server.js. Query operators
// ($in, $exists, $ne, $gt, $gte, $lt, $lte, $nin), patch operators ($set,
// $unset, $inc, $push), sorting and id generation mirror the Node store so
// behavior — including edge cases — stays identical.
declare(strict_types=1);

final class Store
{
    public static function now(): string
    {
        $ms = (int) floor(fmod(microtime(true), 1) * 1000);
        return gmdate('Y-m-d\TH:i:s', time()) . '.' . str_pad((string) $ms, 3, '0', STR_PAD_LEFT) . 'Z';
    }

    public static function exists(string $entity): bool
    {
        $stmt = Db::pdo()->prepare('SELECT 1 FROM entities WHERE entity = ? LIMIT 1');
        $stmt->execute([$entity]);
        return (bool) $stmt->fetchColumn();
    }

    public static function filter(string $entity, array $query = [], array $options = []): array
    {
        $rows = self::all($entity);
        $rows = array_values(array_filter($rows, fn ($row) => self::matchesQuery($row, $query)));
        $rows = self::sortRows($rows, $options['sort'] ?? null);
        if (isset($options['skip']) && is_numeric($options['skip'])) {
            $rows = array_slice($rows, (int) $options['skip']);
        }
        if (isset($options['limit']) && is_numeric($options['limit'])) {
            $rows = array_slice($rows, 0, (int) $options['limit']);
        }
        return $rows;
    }

    public static function count(string $entity, array $query = []): int
    {
        return count(self::filter($entity, $query));
    }

    public static function get(string $entity, string $id): array
    {
        $stmt = Db::pdo()->prepare('SELECT data FROM entities WHERE entity = ? AND id = ?');
        $stmt->execute([$entity, $id]);
        $data = $stmt->fetchColumn();
        if ($data === false) {
            throw new RuntimeException("No {$entity} with id {$id}", 404);
        }
        return json_decode((string) $data, true);
    }

    public static function create(string $entity, array $data): array
    {
        $timestamp = self::now();
        $row = array_merge($data, [
            'id' => $data['id'] ?? self::nextId($entity),
            'created_date' => $data['created_date'] ?? $timestamp,
            'updated_date' => $timestamp,
        ]);
        // The Node store unshifts, so newest rows come first; mirror with a
        // running position below the current minimum.
        $min = Db::pdo()->prepare('SELECT COALESCE(MIN(row_order), 0) FROM entities WHERE entity = ?');
        $min->execute([$entity]);
        $order = ((float) $min->fetchColumn()) - 1;
        $stmt = Db::pdo()->prepare(
            'INSERT INTO entities (entity, id, data, created_at, updated_at, row_order) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$entity, $row['id'], json_encode($row, JSON_UNESCAPED_SLASHES), $order, $order, $order]);
        return $row;
    }

    public static function update(string $entity, string $id, array $data): array
    {
        $row = self::get($entity, $id);
        $row = self::applyPatch($row, $data);
        $row['id'] = $id;
        $row['updated_date'] = self::now();
        $stmt = Db::pdo()->prepare('UPDATE entities SET data = ?, updated_at = ? WHERE entity = ? AND id = ?');
        $stmt->execute([json_encode($row, JSON_UNESCAPED_SLASHES), microtime(true), $entity, $id]);
        return $row;
    }

    public static function delete(string $entity, string $id): array
    {
        $stmt = Db::pdo()->prepare('DELETE FROM entities WHERE entity = ? AND id = ?');
        $stmt->execute([$entity, $id]);
        return ['id' => $id, 'deleted' => $stmt->rowCount() > 0];
    }

    public static function updateMany(string $entity, array $query, array $data): array
    {
        $rows = self::filter($entity, $query);
        foreach ($rows as $row) {
            $row = self::applyPatch($row, $data);
            $row['updated_date'] = self::now();
            $stmt = Db::pdo()->prepare('UPDATE entities SET data = ?, updated_at = ? WHERE entity = ? AND id = ?');
            $stmt->execute([json_encode($row, JSON_UNESCAPED_SLASHES), microtime(true), $entity, $row['id']]);
        }
        return $rows;
    }

    public static function deleteMany(string $entity, array $query): array
    {
        $rows = self::filter($entity, $query);
        $stmt = Db::pdo()->prepare('DELETE FROM entities WHERE entity = ? AND id = ?');
        foreach ($rows as $row) {
            $stmt->execute([$entity, $row['id']]);
        }
        return ['deleted' => count($rows)];
    }

    public static function bulkCreate(string $entity, array $items): array
    {
        return array_map(fn ($item) => self::create($entity, $item), $items);
    }

    public static function bulkUpdate(string $entity, array $items): array
    {
        return array_map(fn ($item) => self::update($entity, (string) $item['id'], $item), $items);
    }

    // --- internals -------------------------------------------------------

    private static function all(string $entity): array
    {
        $stmt = Db::pdo()->prepare('SELECT data FROM entities WHERE entity = ? ORDER BY row_order ASC');
        $stmt->execute([$entity]);
        return array_map(fn ($json) => json_decode((string) $json, true), $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    private static function valuesEqual(mixed $left, mixed $right): bool
    {
        return json_encode($left) === json_encode($right);
    }

    private static function matchesQuery(array $record, ?array $query): bool
    {
        foreach (($query ?? []) as $field => $expected) {
            $hasActual = array_key_exists($field, $record);
            // JS: a missing field reads as undefined, which never JSON-equals a
            // real value and makes every ordering comparison false.
            $actual = $hasActual ? $record[$field] : null;
            if (is_array($expected) && !array_is_list($expected)) {
                // Operator object — checked in the same order as the Node store.
                if (array_key_exists('$in', $expected)) {
                    $hit = false;
                    if ($hasActual) {
                        foreach ((array) $expected['$in'] as $value) {
                            if (self::valuesEqual($actual, $value)) { $hit = true; break; }
                        }
                    }
                    if (!$hit) return false;
                    continue;
                }
                if (array_key_exists('$exists', $expected)) {
                    $present = $hasActual && $actual !== null && $actual !== '';
                    if ($present !== (bool) $expected['$exists']) return false;
                    continue;
                }
                if (array_key_exists('$ne', $expected)) {
                    // !valuesEqual(undefined, x) is always true in JS.
                    if ($hasActual && self::valuesEqual($actual, $expected['$ne'])) return false;
                    continue;
                }
                if (array_key_exists('$gt', $expected)) {
                    if (!$hasActual || !($actual > $expected['$gt'])) return false;
                    continue;
                }
                if (array_key_exists('$gte', $expected)) {
                    if (!$hasActual || !($actual >= $expected['$gte'])) return false;
                    continue;
                }
                if (array_key_exists('$lt', $expected)) {
                    if (!$hasActual || !($actual < $expected['$lt'])) return false;
                    continue;
                }
                if (array_key_exists('$lte', $expected)) {
                    if (!$hasActual || !($actual <= $expected['$lte'])) return false;
                    continue;
                }
                if (array_key_exists('$nin', $expected)) {
                    if ($hasActual) {
                        foreach ((array) $expected['$nin'] as $value) {
                            if (self::valuesEqual($actual, $value)) return false;
                        }
                    }
                    continue;
                }
                if (!$hasActual || !self::valuesEqual($actual, $expected)) return false;
                continue;
            }
            if (!$hasActual) return false;
            if (is_array($actual) && array_is_list($actual)) {
                $hit = false;
                foreach ($actual as $value) {
                    if (self::valuesEqual($value, $expected)) { $hit = true; break; }
                }
                if (!$hit) return false;
                continue;
            }
            if (!self::valuesEqual($actual, $expected)) return false;
        }
        return true;
    }

    private static function compare(mixed $a, mixed $b): int
    {
        if ($a === $b) return 0;
        if ($a === null || $b === null) return $a === null ? 1 : -1;
        return $a <=> $b;
    }

    private static function sortRows(array $rows, mixed $sort): array
    {
        if (!$sort) return $rows;
        $fields = array_filter(is_array($sort) ? $sort : [$sort]);
        usort($rows, function ($left, $right) use ($fields) {
            foreach ($fields as $spec) {
                $descending = str_starts_with((string) $spec, '-');
                $field = ltrim((string) $spec, '+-');
                $result = self::compare($left[$field] ?? null, $right[$field] ?? null);
                if ($result !== 0) return $descending ? -$result : $result;
            }
            return 0;
        });
        return $rows;
    }

    private static function applyPatch(array $row, array $data): array
    {
        foreach ($data as $key => $value) {
            if (!str_starts_with((string) $key, '$')) $row[$key] = $value;
        }
        if (isset($data['$set']) && is_array($data['$set'])) {
            foreach ($data['$set'] as $key => $value) $row[$key] = $value;
        }
        if (isset($data['$unset']) && is_array($data['$unset'])) {
            foreach (array_keys($data['$unset']) as $key) unset($row[$key]);
        }
        if (isset($data['$inc']) && is_array($data['$inc'])) {
            foreach ($data['$inc'] as $key => $amount) {
                $current = $row[$key] ?? null;
                $row[$key] = (is_numeric($current) ? $current + 0 : 0) + $amount;
            }
        }
        if (isset($data['$push']) && is_array($data['$push'])) {
            foreach ($data['$push'] as $key => $value) {
                $list = isset($row[$key]) && is_array($row[$key]) ? $row[$key] : [];
                $list[] = $value;
                $row[$key] = $list;
            }
        }
        return $row;
    }

    private static function nextId(string $entity): string
    {
        return strtolower($entity) . '-' . base_convert((string) (int) floor(microtime(true) * 1000), 10, 36) . '-' . bin2hex(random_bytes(3));
    }

    private function __construct() {}
}
