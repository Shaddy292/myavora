<?php
// Port of src/lib/partner-admin-fns.js: administrator controls for stores and
// rider profiles.
declare(strict_types=1);

final class PartnerAdminFns
{
    public static function registry(): array
    {
        return [
            'partner-admin/adminVendorBoard' => ['auth' => true, 'run' => [self::class, 'adminVendorBoard']],
            'partner-admin/adminUpdateVendor' => ['auth' => true, 'run' => [self::class, 'adminUpdateVendor']],
            'partner-admin/adminRiderBoard' => ['auth' => true, 'run' => [self::class, 'adminRiderBoard']],
            'partner-admin/adminSetRiderDocs' => ['auth' => true, 'run' => [self::class, 'adminSetRiderDocs']],
        ];
    }

    public static function adminVendorBoard(array $data, array $user): array
    {
        self::requireAdmin($user);
        return ['stores' => Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200])];
    }

    public static function adminUpdateVendor(array $data, array $user): array
    {
        self::requireAdmin($user);
        $patch = [];
        if (array_key_exists('is_open', $data)) $patch['is_open'] = (bool) $data['is_open'];
        if (array_key_exists('commission_rate', $data)) {
            $rate = Fns::number($data['commission_rate']);
            if ($rate === null || $rate < 0 || $rate > 0.9) Fns::fail(400, 'Commission must be between 0 and 0.9.');
            $patch['commission_rate'] = $rate;
        }
        if (!$patch) return ['ok' => true];
        return Store::update('Store', Fns::str($data['store_id'] ?? ''), $patch);
    }

    public static function adminRiderBoard(array $data, array $user): array
    {
        self::requireAdmin($user);
        return ['riders' => Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 200])];
    }

    public static function adminSetRiderDocs(array $data, array $user): array
    {
        self::requireAdmin($user);
        $status = Fns::str($data['docs_status'] ?? '');
        if (!in_array($status, ['missing', 'submitted', 'verified', 'rejected'], true)) {
            Fns::fail(400, 'Pick a document status.');
        }
        return Store::update('RiderProfile', Fns::str($data['rider_id'] ?? ''), ['docs_status' => $status]);
    }

    private static function requireAdmin(array $user): void
    {
        if (($user['role'] ?? null) !== 'admin') Fns::fail(403, 'Only administrators can manage partners.');
    }

    private function __construct() {}
}
