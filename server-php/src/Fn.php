<?php
// Small helpers shared by the server-function ports. The originals live in
// src/lib/*-fns.js; these mirror the JS value handling (nullish fallbacks,
// string coercion) so the PHP result shapes stay identical.
declare(strict_types=1);

final class Fns
{
    public const FEE_FALLBACKS = ['vendorPct' => 10, 'riderPct' => 10, 'joinFee' => 30000, 'monthlyFee' => 2000];

    public static function fail(int $status, string $message): never
    {
        throw new RuntimeException($message, $status);
    }

    public static function ngn(mixed $value): string
    {
        return '₦' . number_format((float) round((float) $value), 0, '', ',');
    }

    public static function matchesAny(array $record, string $needle, array $fields): bool
    {
        foreach ($fields as $field) {
            if (str_contains(strtolower((string) ($record[$field] ?? '')), $needle)) return true;
        }
        return false;
    }

    /** JS `String(value ?? "")` for scalar ids and labels. */
    public static function str(mixed $value): string
    {
        if ($value === null) return '';
        if (is_bool($value)) return $value ? 'true' : 'false';
        if (is_array($value)) return '';
        return (string) $value;
    }

    /** JS `Number(value)`, returning null for NaN-ish input. */
    public static function number(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) return (float) $value;
        if (is_string($value) && is_numeric(trim($value))) return (float) trim($value);
        if (is_bool($value)) return $value ? 1.0 : 0.0;
        return null;
    }

    /** JS `Number(value) || $fallback`. */
    public static function numberOr(mixed $value, float $fallback): float
    {
        $number = self::number($value);
        return $number === null || $number == 0.0 ? $fallback : $number;
    }

    public static function round(mixed $value): int
    {
        return (int) round((float) self::number($value));
    }

    /** JS `value || fallback` for strings and nullish values. */
    public static function or(mixed $value, mixed $fallback): mixed
    {
        if ($value === null || $value === false || $value === '' || $value === 0 || $value === 0.0) return $fallback;
        return $value;
    }

    public static function userEmail(?array $user): string
    {
        return strtolower(self::str($user['email'] ?? ''));
    }

    public static function displayName(array $user): string
    {
        return self::str($user['full_name'] ?? '') ?: self::str($user['email'] ?? '');
    }

    /** ISO-8601 with milliseconds, the shape new Date().toISOString() emits. */
    public static function nowIso(): string
    {
        return Store::now();
    }

    /** `new Date(value).toISOString().slice(0, 10)` */
    public static function dayKey(mixed $value): string
    {
        if ($value === null || $value === '') return '';
        $time = is_numeric($value) ? (float) $value / 1000 : strtotime(self::str($value));
        return $time ? gmdate('Y-m-d', (int) $time) : '';
    }

    /** `new Date(value).getTime()` in milliseconds, or null when unparsable. */
    public static function timeMs(mixed $value): ?float
    {
        if ($value === null || $value === '') return null;
        if (is_numeric($value)) return (float) $value;
        $time = strtotime(self::str($value));
        return $time === false ? null : $time * 1000;
    }

    public static function shortId(mixed $id, int $size): string
    {
        return strtoupper(substr(self::str($id), -$size));
    }

    public static function monthEnd(string $period): string
    {
        [$year, $month] = array_pad(array_map('intval', explode('-', $period)), 2, 1);
        return gmdate('Y-m-d', gmmktime(0, 0, 0, $month + 1, 1, $year) - 86400);
    }

    public static function periodOf(mixed $date = null): string
    {
        $time = $date === null ? time() : (strtotime(self::str($date)) ?: time());
        return gmdate('Y-m', $time);
    }

    /** @return array<int,array> */
    public static function storesOwnedBy(string $email): array
    {
        return Store::filter('Store', ['owner_email' => $email]);
    }

    /** @return string[] */
    public static function ownedStoreIds(string $email): array
    {
        return array_map(fn ($store) => self::str($store['id'] ?? ''), self::storesOwnedBy($email));
    }

    /** Staff role for the signed-in account (admin, ops, finance, support or customer). */
    public static function staffRole(array $user): string
    {
        if (($user['role'] ?? null) === 'admin') return 'admin';
        $rows = Store::filter('StaffMember', ['email' => self::userEmail($user), 'is_active' => true]);
        return self::str($rows[0]['role'] ?? '') ?: 'customer';
    }

    public static function assertStaffRole(array $user, array $roles, string $message = 'Forbidden'): void
    {
        if (!in_array(self::staffRole($user), $roles, true)) self::fail(403, $message);
    }

    /** @return array<int,array> */
    public static function myStores(array $user): array
    {
        return self::storesOwnedBy(self::userEmail($user));
    }

    public static function myStore(array $user): ?array
    {
        return self::myStores($user)[0] ?? null;
    }

    public static function myRider(array $user): ?array
    {
        $rows = Store::filter('RiderProfile', ['user_email' => self::userEmail($user)]);
        return $rows[0] ?? null;
    }

    public static function findOne(string $entity, array $query, ?array $options = null): ?array
    {
        $rows = Store::filter($entity, $query, $options ?? []);
        return $rows[0] ?? null;
    }

    /** Platform fees, falling back to the defaults from finance-fns.js. */
    public static function loadFees(): array
    {
        $setting = self::findOne('PlatformSetting', [], ['sort' => '-created_date', 'limit' => 1]);
        return [
            'vendorPct' => $setting['vendor_commission_pct'] ?? self::FEE_FALLBACKS['vendorPct'],
            'riderPct' => $setting['rider_commission_pct'] ?? self::FEE_FALLBACKS['riderPct'],
            'joinFee' => $setting['vendor_join_fee'] ?? self::FEE_FALLBACKS['joinFee'],
            'monthlyFee' => $setting['vendor_monthly_fee'] ?? self::FEE_FALLBACKS['monthlyFee'],
        ];
    }

    /** Port of promoDiscount() in src/lib/promo.js. */
    public static function promoDiscount(?array $promo, float $subtotal): int
    {
        if (!$promo) return 0;
        $value = self::number($promo['value'] ?? 0) ?? 0.0;
        $raw = ($promo['discount_type'] ?? null) === 'fixed' ? $value : round($subtotal * $value / 100);
        $cap = self::number($promo['max_discount'] ?? null);
        $capped = $cap !== null && $cap > 0 ? min($raw, $cap) : $raw;
        return (int) max(0, min(round($capped), $subtotal));
    }

    /** Port of promoProblem() in src/lib/promo.js. Null means the code applies. */
    public static function promoProblem(?array $promo, float $subtotal, ?string $storeId): ?string
    {
        if (!$promo || ($promo['is_active'] ?? null) === false) return "That promo code isn't valid.";
        $expires = self::timeMs($promo['expires_at'] ?? null);
        if ($expires !== null && $expires < microtime(true) * 1000) return 'That promo code has expired.';
        $limit = self::number($promo['usage_limit'] ?? null) ?? 0.0;
        if ($limit > 0 && (int) ($promo['used_count'] ?? 0) >= $limit) return 'That promo code has been fully redeemed.';
        $min = self::number($promo['min_order'] ?? null) ?? 0.0;
        if ($min > 0 && $subtotal < $min) return 'Your basket is below the minimum spend for this code.';
        $promoStore = self::str($promo['store_id'] ?? '');
        if ($promoStore !== '' && $storeId !== null && $storeId !== '' && $promoStore !== $storeId) {
            return "This code doesn't apply to this store.";
        }
        return null;
    }

    public static function audit(array $actor, string $action, mixed $target, string $detail, string $severity = 'info'): array
    {
        return Store::create('AuditLog', [
            'actor_email' => self::userEmail($actor),
            'action' => $action,
            'target' => self::str($target),
            'detail' => $detail,
            'severity' => $severity,
        ]);
    }

    /** `[...new Set(values)]` preserving first-seen order. */
    public static function unique(array $values): array
    {
        $seen = [];
        $out = [];
        foreach ($values as $value) {
            $key = json_encode($value);
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $out[] = $value;
        }
        return $out;
    }

    private function __construct() {}
}
