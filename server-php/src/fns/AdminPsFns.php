<?php
// Port of src/lib/admin-ps-fns.js: platform settings, delivery zones, the
// admin catalogue, rider dispatch and refund decisions.
declare(strict_types=1);

final class AdminPsFns
{
    private const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'rider_assigned', 'picked_up'];
    private const BOARD_STATUSES = ['ready_for_pickup', 'rider_assigned', 'picked_up', 'preparing', 'accepted'];
    private const REFUND_STATUSES = ['approved', 'rejected', 'processed'];
    private const STAFF_REFUND_ROLES = ['admin', 'finance', 'support', 'ops'];

    // ALLOWED in admin-ps-fns.js.
    private const ALLOWED = [
        'settings' => ['admin'],
        'zones' => ['admin', 'ops'],
        'catalogue' => ['admin', 'ops'],
        'dispatch' => ['admin', 'ops'],
        'money' => ['admin', 'finance'],
    ];

    private const SETTINGS_TEXT = ['business_name', 'legal_name', 'support_email', 'support_phone', 'ops_note'];
    private const SETTINGS_NUMBERS = [
        'service_fee_pct', 'delivery_base_fee', 'min_order_value', 'rider_payout_base',
        'vendor_commission_pct', 'rider_commission_pct', 'vendor_join_fee', 'vendor_monthly_fee',
    ];
    private const SETTINGS_FLAGS = ['auto_approve_vendors', 'allow_cash_on_delivery', 'maintenance_mode'];
    private const SETTINGS_REQUIRED = [
        'business_name', 'service_fee_pct', 'delivery_base_fee', 'min_order_value',
        'rider_payout_base', 'vendor_commission_pct', 'auto_approve_vendors',
        'allow_cash_on_delivery', 'maintenance_mode',
    ];

    private const ZONE_TEXT = ['name', 'area', 'notes'];
    private const ZONE_NUMBERS = ['center_lat', 'center_lng', 'radius_km', 'delivery_fee'];
    private const ZONE_REQUIRED = ['name', 'center_lat', 'center_lng', 'radius_km', 'delivery_fee', 'is_active'];

    private const PRODUCT_TEXT = ['name', 'category'];
    private const PRODUCT_NUMBERS = ['price'];

    public static function registry(): array
    {
        return [
            'admin-ps/platformSettings' => ['auth' => true, 'run' => [self::class, 'platformSettings']],
            'admin-ps/savePlatformSettings' => ['auth' => true, 'run' => [self::class, 'savePlatformSettings']],
            'admin-ps/deliveryZoneBoard' => ['auth' => true, 'run' => [self::class, 'deliveryZoneBoard']],
            'admin-ps/saveDeliveryZone' => ['auth' => true, 'run' => [self::class, 'saveDeliveryZone']],
            'admin-ps/deleteDeliveryZone' => ['auth' => true, 'run' => [self::class, 'deleteDeliveryZone']],
            'admin-ps/adminCatalogue' => ['auth' => true, 'run' => [self::class, 'adminCatalogue']],
            'admin-ps/adminUpdateProduct' => ['auth' => true, 'run' => [self::class, 'adminUpdateProduct']],
            'admin-ps/adminDeleteProduct' => ['auth' => true, 'run' => [self::class, 'adminDeleteProduct']],
            'admin-ps/dispatchBoard' => ['auth' => true, 'run' => [self::class, 'dispatchBoard']],
            'admin-ps/assignRider' => ['auth' => true, 'run' => [self::class, 'assignRider']],
            'admin-ps/releaseRider' => ['auth' => true, 'run' => [self::class, 'releaseRider']],
            'admin-ps/refundBoard' => ['auth' => true, 'run' => [self::class, 'refundBoard']],
            'admin-ps/updateRefund' => ['auth' => true, 'run' => [self::class, 'updateRefund']],
            'admin-ps/openRefund' => ['auth' => true, 'run' => [self::class, 'openRefund']],
        ];
    }

    /* --------------------------------------------------------------- settings */

    public static function platformSettings(array $data, ?array $user): array
    {
        self::allow($user, 'settings');
        $records = Store::filter('PlatformSetting', [], ['sort' => '-created_date', 'limit' => 5]);
        return ['setting' => $records[0] ?? null];
    }

    public static function savePlatformSettings(array $data, ?array $user): array
    {
        self::allow($user, 'settings');
        self::requireKeys($data, self::SETTINGS_REQUIRED);
        if (Fns::str($data['business_name'] ?? '') === '') Fns::fail(400, 'Business name is required.');

        $existing = Store::filter('PlatformSetting', [], ['sort' => '-created_date', 'limit' => 1])[0] ?? null;
        $payload = self::settingsPayload($data);
        $payload['updated_by'] = Fns::userEmail($user);

        $saved = $existing
            ? Store::update('PlatformSetting', Fns::str($existing['id'] ?? ''), $payload)
            : Store::create('PlatformSetting', $payload);
        Fns::audit($user ?? [], 'settings.update', 'PlatformSetting', 'Platform settings saved', 'warning');
        return $saved;
    }

    /* ---------------------------------------------------------- delivery zones */

    public static function deliveryZoneBoard(array $data, ?array $user): array
    {
        self::allow($user, 'zones');
        $zones = Store::filter('DeliveryZone', [], ['sort' => '-created_date', 'limit' => 100]);
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200]);
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);

        $active = array_values(array_filter(
            $orders,
            fn ($order) => in_array($order['status'] ?? null, self::ACTIVE_STATUSES, true)
        ));

        $mapped = array_map(function ($zone) use ($stores, $active) {
            $key = self::zoneKey($zone);
            $storeCount = count(array_filter($stores, fn ($store) => Fns::str($store['area'] ?? '') === $key));
            $activeOrders = count(array_filter($active, fn ($order) => Fns::str($order['address_area'] ?? '') === $key));
            return array_merge($zone, ['storeCount' => $storeCount, 'activeOrders' => $activeOrders]);
        }, $zones);

        $uncovered = array_values(array_filter($stores, function ($store) use ($zones) {
            foreach ($zones as $zone) {
                if (self::zoneKey($zone) === ($store['area'] ?? null)) return false;
            }
            return true;
        }));

        return ['zones' => $mapped, 'uncovered' => array_slice($uncovered, 0, 10)];
    }

    public static function saveDeliveryZone(array $data, ?array $user): array
    {
        self::allow($user, 'zones');
        self::requireKeys($data, self::ZONE_REQUIRED);
        if (Fns::str($data['name'] ?? '') === '') Fns::fail(400, 'Zone name is required.');

        $id = Fns::str($data['id'] ?? '');
        $payload = self::zonePayload($data);
        $saved = $id !== ''
            ? Store::update('DeliveryZone', $id, $payload)
            : Store::create('DeliveryZone', $payload);

        $radius = self::numberText($data['radius_km'] ?? 0);
        Fns::audit(
            $user ?? [],
            $id !== '' ? 'zone.update' : 'zone.create',
            $saved['name'] ?? '',
            $radius . ' km radius'
        );
        return $saved;
    }

    public static function deleteDeliveryZone(array $data, ?array $user): array
    {
        self::allow($user, 'zones');
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'A zone id is required.');

        try {
            $zone = Store::get('DeliveryZone', $id);
        } catch (Throwable) {
            $zone = null;
        }
        if (!$zone) Fns::fail(404, 'That delivery area no longer exists.');

        Store::delete('DeliveryZone', $id);
        Fns::audit($user ?? [], 'zone.delete', $zone['name'] ?? '', 'Delivery area removed', 'warning');
        return ['ok' => true];
    }

    /* --------------------------------------------------------------- catalogue */

    public static function adminCatalogue(array $data, ?array $user): array
    {
        self::allow($user, 'catalogue');
        return [
            'products' => Store::filter('Product', [], ['sort' => '-created_date', 'limit' => 400]),
            'stores' => Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200]),
            'categories' => Store::filter('Category', [], ['sort' => 'position', 'limit' => 60]),
        ];
    }

    public static function adminUpdateProduct(array $data, ?array $user): array
    {
        self::allow($user, 'catalogue');
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'A product id is required.');

        $patch = self::productPayload($data);
        $saved = Store::update('Product', $id, $patch);
        Fns::audit($user ?? [], 'catalogue.update', $saved['name'] ?? '', implode(', ', array_keys($patch)));
        return $saved;
    }

    public static function adminDeleteProduct(array $data, ?array $user): array
    {
        self::allow($user, 'catalogue');
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'A product id is required.');

        try {
            $product = Store::get('Product', $id);
        } catch (Throwable) {
            $product = null;
        }
        if (!$product) Fns::fail(404, 'That item no longer exists.');

        Store::delete('Product', $id);
        Fns::audit($user ?? [], 'catalogue.delete', $product['name'] ?? '', 'Listing removed', 'warning');
        return ['ok' => true];
    }

    /* ---------------------------------------------------------------- dispatch */

    public static function dispatchBoard(array $data, ?array $user): array
    {
        self::allow($user, 'dispatch');
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 200]);
        $zones = Store::filter('DeliveryZone', [], ['sort' => '-created_date', 'limit' => 60]);

        $active = array_values(array_filter(
            $orders,
            fn ($order) => in_array($order['status'] ?? null, self::BOARD_STATUSES, true)
        ));

        return [
            'orders' => $active,
            'unassigned' => count(array_filter(
                $active,
                fn ($order) => !self::truthy($order['rider_email'] ?? null)
            )),
            'riders' => array_values(array_filter(
                $riders,
                fn ($rider) => ($rider['status'] ?? null) === 'approved'
            )),
            'zones' => $zones,
        ];
    }

    public static function assignRider(array $data, ?array $user): array
    {
        self::allow($user, 'dispatch');
        $orderId = Fns::str($data['order_id'] ?? '');
        if ($orderId === '') Fns::fail(400, 'An order id is required.');
        $riderEmail = Fns::str($data['rider_email'] ?? '');
        if ($riderEmail === '') Fns::fail(400, 'A rider email is required.');

        $order = Store::get('Order', $orderId);
        $profiles = Store::filter('RiderProfile', ['user_email' => $riderEmail]);
        $profile = $profiles[0] ?? null;
        if (!$profile) Fns::fail(404, 'That rider has no profile yet.');
        if (($profile['status'] ?? null) !== 'approved') {
            Fns::fail(409, 'Only approved riders can be dispatched.');
        }

        $at = Fns::nowIso();
        $timeline = is_array($order['timeline'] ?? null) ? $order['timeline'] : [];
        $timeline[] = [
            'status' => 'rider_assigned',
            'at' => $at,
            'note' => 'Dispatched to ' . Fns::str($profile['full_name'] ?? ''),
            'by' => Fns::userEmail($user),
        ];

        $deliveryFee = Fns::number($order['delivery_fee'] ?? null);
        if ($deliveryFee === null || $deliveryFee == 0.0) $deliveryFee = 500.0;

        $saved = Store::update('Order', Fns::str($order['id'] ?? ''), [
            'rider_email' => $profile['user_email'] ?? '',
            'rider_name' => $profile['full_name'] ?? '',
            'rider_phone' => $profile['phone'] ?? '',
            'rider_payout' => self::truthy($order['rider_payout'] ?? null)
                ? $order['rider_payout']
                : self::jsRound($deliveryFee * 0.9),
            'status' => ($order['status'] ?? null) === 'picked_up' ? $order['status'] : 'rider_assigned',
            'timeline' => $timeline,
        ]);

        Store::create('Notification', [
            'user_email' => $profile['user_email'] ?? '',
            'key' => 'dispatch-' . Fns::str($order['id'] ?? '') . '-' . self::nowMs(),
            'kind' => 'order',
            'title' => 'New delivery assigned',
            'body' => Fns::str($order['store_name'] ?? '') . ' · ' . self::firstText(
                [$order['address_area'] ?? null, $order['address_label'] ?? null],
                'delivery'
            ),
            'link' => '/rider',
            'order_code' => $order['code'] ?? '',
        ]);
        Fns::audit(
            $user ?? [],
            'dispatch.assign',
            $order['code'] ?? '',
            'Rider ' . Fns::str($profile['full_name'] ?? '')
        );
        return $saved;
    }

    public static function releaseRider(array $data, ?array $user): array
    {
        self::allow($user, 'dispatch');
        $orderId = Fns::str($data['order_id'] ?? '');
        if ($orderId === '') Fns::fail(400, 'An order id is required.');

        $order = Store::get('Order', $orderId);
        if (!self::truthy($order['rider_email'] ?? null)) return $order;

        $timeline = is_array($order['timeline'] ?? null) ? $order['timeline'] : [];
        $timeline[] = [
            'status' => 'ready_for_pickup',
            'at' => Fns::nowIso(),
            'note' => self::truthy($data['note'] ?? null)
                ? Fns::str($data['note'])
                : 'Rider removed — waiting for a new dispatch',
            'by' => Fns::userEmail($user),
        ];

        $saved = Store::update('Order', Fns::str($order['id'] ?? ''), [
            'rider_email' => '',
            'rider_name' => '',
            'rider_phone' => '',
            'status' => 'ready_for_pickup',
            'timeline' => $timeline,
        ]);
        Fns::audit($user ?? [], 'dispatch.release', $order['code'] ?? '', 'Rider unassigned', 'warning');
        return $saved;
    }

    /* ----------------------------------------------------------------- refunds */

    public static function refundBoard(array $data, ?array $user): array
    {
        self::allow($user, 'money');
        return [
            'refunds' => Store::filter('Refund', [], ['sort' => '-created_date', 'limit' => 150]),
            'orders' => Store::filter(
                'Order',
                ['payment_status' => ['$in' => ['paid', 'cash_due']]],
                ['sort' => '-created_date', 'limit' => 120]
            ),
        ];
    }

    public static function updateRefund(array $data, ?array $user): array
    {
        self::allow($user, 'money');
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'A refund id is required.');
        $status = Fns::str($data['status'] ?? '');
        if (!in_array($status, self::REFUND_STATUSES, true)) Fns::fail(400, 'That refund status is not valid.');

        $refund = Store::get('Refund', $id);
        $note = array_key_exists('note', $data) && $data['note'] !== null
            ? Fns::str($data['note'])
            : (($refund['note'] ?? null) === null ? '' : Fns::str($refund['note']));

        $saved = Store::update('Refund', Fns::str($refund['id'] ?? ''), [
            'status' => $status,
            'note' => $note,
            'decided_by' => Fns::userEmail($user),
        ]);

        if (in_array($status, ['approved', 'processed'], true) && self::truthy($refund['order_id'] ?? null)) {
            try {
                Store::update('Order', Fns::str($refund['order_id']), ['payment_status' => 'refunded']);
            } catch (Throwable) {
                // Mirrors the JS .catch(() => null).
            }
            Store::updateMany(
                'Payment',
                ['order_id' => $refund['order_id']],
                ['$set' => ['status' => 'refunded', 'note' => 'Refund ' . $status]]
            );
            Store::create('Notification', [
                'user_email' => $refund['customer_email'] ?? '',
                'key' => 'refund-' . Fns::str($refund['id'] ?? '') . '-' . $status,
                'kind' => 'order',
                'title' => $status === 'processed' ? 'Refund paid out' : 'Refund approved',
                'body' => 'Order ' . Fns::str($refund['order_code'] ?? '') . ' · ' . Fns::ngn($refund['amount'] ?? 0),
                'link' => '/payment-history',
                'order_code' => $refund['order_code'] ?? '',
            ]);
        }

        Fns::audit($user ?? [], 'refund.' . $status, $refund['order_code'] ?? '', Fns::str($data['note'] ?? ''), 'warning');
        return $saved;
    }

    public static function openRefund(array $data, ?array $user): array
    {
        $orderId = Fns::str($data['order_id'] ?? '');
        if ($orderId === '') Fns::fail(400, 'An order id is required.');

        try {
            $order = Store::get('Order', $orderId);
        } catch (Throwable) {
            $order = null;
        }
        if (!$order) Fns::fail(404, 'That order no longer exists.');

        $role = Fns::staffRole($user ?? []);
        $staff = in_array($role, self::STAFF_REFUND_ROLES, true);
        if (!$staff && Fns::str($order['customer_email'] ?? '') !== Fns::userEmail($user)) {
            Fns::fail(403, 'You can only request a refund on your own order.');
        }

        $amount = Fns::number($data['amount'] ?? null);
        if ($amount === null) Fns::fail(400, 'A refund amount is required.');
        if ($amount < 1) Fns::fail(400, 'A refund amount must be at least ₦1.');

        $total = Fns::number($order['total'] ?? null);
        $charge = ($total === null || $total == 0.0 ? $amount : $total);

        $refund = Store::create('Refund', [
            'order_id' => $order['id'] ?? '',
            'order_code' => $order['code'] ?? '',
            'customer_email' => $order['customer_email'] ?? '',
            'amount' => self::num(min($amount, $charge)),
            'reason' => Fns::str($data['reason'] ?? ''),
            'status' => 'requested',
            'requested_by' => Fns::userEmail($user),
        ]);
        Fns::audit($user ?? [], 'refund.request', $order['code'] ?? '', '₦' . self::numberText($amount), 'warning');
        return $refund;
    }

    /* ----------------------------------------------------------------- helpers */

    private static function allow(?array $user, string $area): string
    {
        $role = Fns::staffRole($user ?? []);
        if (!in_array($role, self::ALLOWED[$area], true)) {
            Fns::fail(403, 'You do not have permission to manage this area.');
        }
        return $role;
    }

    /** `(zone.area || zone.name)` — null when neither is set, like undefined. */
    private static function zoneKey(array $zone): ?string
    {
        $area = Fns::str($zone['area'] ?? '');
        if ($area !== '') return $area;
        if (!array_key_exists('name', $zone) || $zone['name'] === null) return null;
        return Fns::str($zone['name']);
    }

    /** JS truthiness for the `value || fallback` and `!value` checks in the module. */
    private static function truthy(mixed $value): bool
    {
        if ($value === null || $value === false || $value === '' || $value === 0 || $value === 0.0) return false;
        return !(is_array($value) && $value === []);
    }

    /** First truthy candidate, else the fallback (JS `a || b || fallback`). */
    private static function firstText(array $candidates, string $fallback): string
    {
        foreach ($candidates as $candidate) {
            if (self::truthy($candidate)) return Fns::str($candidate);
        }
        return $fallback;
    }

    /** Numeric payload values keep JS number shape: 5 stays 5, 5.5 stays 5.5. */
    private static function num(mixed $value): int|float
    {
        $number = Fns::number($value) ?? 0.0;
        if (floor($number) === $number && abs($number) < 1.0e15) return (int) $number;
        return $number;
    }

    /** `Math.round()` — halves round up, unlike PHP's round() for negatives. */
    private static function jsRound(float $value): int
    {
        return (int) floor($value + 0.5);
    }

    /** `${number}` interpolation, e.g. `5.5 km radius`. */
    private static function numberText(mixed $value): string
    {
        $number = Fns::number($value);
        if ($number === null) return '';
        if (floor($number) === $number && abs($number) < 1.0e15) return (string) (int) $number;
        return rtrim(rtrim(number_format($number, 6, '.', ''), '0'), '.');
    }

    private static function flag(mixed $value): bool
    {
        if (is_bool($value)) return $value;
        if (is_string($value)) return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        if (is_int($value) || is_float($value)) return $value != 0;
        return false;
    }

    private static function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private static function requireKeys(array $data, array $keys): void
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $data) || $data[$key] === null) {
                Fns::fail(400, 'Missing required field: ' . $key . '.');
            }
        }
    }

    /** The SettingsInput fields, in the order the caller sent them. */
    private static function settingsPayload(array $data): array
    {
        $payload = [];
        foreach ($data as $key => $value) {
            if (in_array($key, self::SETTINGS_TEXT, true)) {
                $payload[$key] = Fns::str($value);
            } elseif (in_array($key, self::SETTINGS_NUMBERS, true)) {
                $payload[$key] = self::num($value);
            } elseif (in_array($key, self::SETTINGS_FLAGS, true)) {
                $payload[$key] = self::flag($value);
            }
        }
        return $payload;
    }

    /** The ZoneInput fields with `id` stripped, as saveDeliveryZone destructures it. */
    private static function zonePayload(array $data): array
    {
        $payload = [];
        foreach ($data as $key => $value) {
            if ($key === 'id') continue;
            if (in_array($key, self::ZONE_TEXT, true)) {
                $payload[$key] = Fns::str($value);
            } elseif (in_array($key, self::ZONE_NUMBERS, true)) {
                $payload[$key] = self::num($value);
            } elseif ($key === 'is_active') {
                $payload[$key] = self::flag($value);
            }
        }
        return $payload;
    }

    /** The adminUpdateProduct patch (every field optional). */
    private static function productPayload(array $data): array
    {
        $payload = [];
        foreach ($data as $key => $value) {
            if ($key === 'id') continue;
            if (in_array($key, self::PRODUCT_TEXT, true)) {
                $payload[$key] = Fns::str($value);
            } elseif (in_array($key, self::PRODUCT_NUMBERS, true)) {
                $payload[$key] = self::num($value);
            } elseif ($key === 'stock') {
                $payload[$key] = self::jsRound((float) (Fns::number($value) ?? 0.0));
            } elseif ($key === 'is_available') {
                $payload[$key] = self::flag($value);
            }
        }
        return $payload;
    }

    private function __construct() {}
}
