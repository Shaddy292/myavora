<?php
// Port of src/lib/insight-fns.js: site content plus vendor, rider and admin reads.
declare(strict_types=1);

final class InsightFns
{
    private const PERMISSION_MESSAGE = 'You do not have permission to open this area.';
    private const PROMO_STORES_LIMIT = 40;
    private const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'rider_assigned', 'picked_up'];
    private const ORDER_STATUS_LABELS = [
        'placed' => 'New order',
        'accepted' => 'Accepted',
        'preparing' => 'Preparing',
        'ready_for_pickup' => 'Ready for pickup',
        'rider_assigned' => 'Rider assigned',
        'picked_up' => 'On the way',
        'delivered' => 'Delivered',
        'cancelled' => 'Cancelled',
        'failed' => 'Failed',
    ];

    public static function registry(): array
    {
        return [
            'insight/vendorMonthlyInsights' => ['auth' => true, 'run' => [self::class, 'vendorMonthlyInsights']],
            'insight/riderPayoutBoard' => ['auth' => true, 'run' => [self::class, 'riderPayoutBoard']],
            'insight/adminFleetBoard' => ['auth' => true, 'run' => [self::class, 'adminFleetBoard']],
            'insight/adminAuditTrail' => ['auth' => true, 'run' => [self::class, 'adminAuditTrail']],
            'insight/notificationsFeed' => ['auth' => true, 'run' => [self::class, 'notificationsFeed']],
            'insight/markNotificationRead' => ['auth' => true, 'run' => [self::class, 'markNotificationRead']],
            'insight/markAllNotificationsRead' => ['auth' => true, 'run' => [self::class, 'markAllNotificationsRead']],
            'insight/riderShifts' => ['auth' => true, 'run' => [self::class, 'riderShifts']],
            'insight/addRiderShift' => ['auth' => true, 'run' => [self::class, 'addRiderShift']],
            'insight/removeRiderShift' => ['auth' => true, 'run' => [self::class, 'removeRiderShift']],
            'insight/saveRiderDocuments' => ['auth' => true, 'run' => [self::class, 'saveRiderDocuments']],
            'insight/getSiteContent' => ['auth' => false, 'run' => [self::class, 'getSiteContent']],
            'insight/saveSiteContent' => ['auth' => true, 'run' => [self::class, 'saveSiteContent']],
        ];
    }

    /* ------------------------------------------------------- vendor analytics */

    public static function vendorMonthlyInsights(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $store = Fns::findOne('Store', ['owner_email' => $email]);
        if (!$store) return ['store' => null];

        $orders = Store::filter('Order', ['store_id' => $store['id']], ['sort' => '-created_date', 'limit' => 400]);
        $delivered = array_values(array_filter($orders, fn ($order) => ($order['status'] ?? null) === 'delivered'));

        // new Date(); setDate(1); setMonth(getMonth() - i) — local time, then
        // toISOString().slice(0, 7) for the key and toLocaleString() for the label.
        $now = new DateTimeImmutable('now');
        $firstOfMonth = $now->setDate((int) $now->format('Y'), (int) $now->format('n'), 1)->setTime(0, 0, 0);
        $months = [];
        for ($i = 5; $i >= 0; $i -= 1) {
            $date = $firstOfMonth->modify("-{$i} months");
            $key = Fns::periodOf($date->format('c'));
            $monthOrders = array_values(array_filter(
                $orders,
                fn ($order) => Fns::periodOf($order['created_date'] ?? null) === $key
            ));
            $monthDelivered = array_values(array_filter(
                $monthOrders,
                fn ($order) => ($order['status'] ?? null) === 'delivered'
            ));
            $sales = 0.0;
            $monthRatings = [];
            foreach ($monthDelivered as $order) {
                $sales += Fns::numberOr($order['total'] ?? 0, 0.0);
                if (self::truthy($order['rating'] ?? null)) $monthRatings[] = $order['rating'];
            }
            $months[] = [
                'key' => $key,
                'month' => $date->format('M'),
                'sales' => $sales,
                'orders' => count($monthOrders),
                'rating' => self::average1($monthRatings),
            ];
        }

        $productMap = [];
        foreach ($delivered as $order) {
            foreach (self::listOf($order['items'] ?? null) as $item) {
                if (!is_array($item)) continue;
                $name = $item['name'] ?? null;
                $mapKey = Fns::str($name);
                if (!isset($productMap[$mapKey])) {
                    $productMap[$mapKey] = ['name' => $name, 'qty' => 0.0, 'revenue' => 0.0];
                }
                $qty = Fns::numberOr($item['qty'] ?? 0, 0.0);
                $productMap[$mapKey]['qty'] += $qty;
                $productMap[$mapKey]['revenue'] += Fns::numberOr($item['unit_price'] ?? 0, 0.0) * $qty;
            }
        }
        $topProducts = array_values($productMap);
        usort($topProducts, fn ($a, $b) => $b['qty'] <=> $a['qty']);
        $topProducts = array_slice($topProducts, 0, 8);

        $prepTimes = [];
        $ratings = [];
        $recentPrep = [];
        $salesTotal = 0.0;
        foreach ($orders as $order) {
            $minutes = self::prepMinutes($order);
            if ($minutes !== null && $minutes >= 0) $prepTimes[] = $minutes;
            if ($minutes !== null && count($recentPrep) < 8) {
                $recentPrep[] = [
                    'id' => $order['id'] ?? null,
                    'code' => $order['code'] ?? null,
                    'minutes' => $minutes,
                    'at' => $order['created_date'] ?? null,
                ];
            }
        }
        foreach ($delivered as $order) {
            $salesTotal += Fns::numberOr($order['total'] ?? 0, 0.0);
            if (self::truthy($order['rating'] ?? null)) $ratings[] = $order['rating'];
        }

        return [
            'store' => $store,
            'months' => $months,
            'totals' => [
                'sales' => $salesTotal,
                'delivered' => count($delivered),
                'orders' => count($orders),
                'avgOrder' => count($delivered) ? self::jsRound($salesTotal / count($delivered)) : 0,
                'avgPrep' => $prepTimes ? self::jsRound(array_sum($prepTimes) / count($prepTimes)) : null,
                'fastestPrep' => $prepTimes ? min($prepTimes) : null,
                'rating' => self::average1($ratings),
                'rated' => count($ratings),
            ],
            'topProducts' => $topProducts,
            'recentPrep' => $recentPrep,
        ];
    }

    /* --------------------------------------------------------- rider payouts */

    public static function riderPayoutBoard(array $data, ?array $user): array
    {
        Fns::assertStaffRole($user ?? [], ['admin', 'finance'], self::PERMISSION_MESSAGE);
        $settlements = Store::filter('Settlement', [], ['sort' => '-created_date', 'limit' => 200]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 400]);

        $riderSettlements = array_values(array_filter(
            $settlements,
            fn ($row) => ($row['subject_type'] ?? null) === 'rider'
        ));
        $delivered = array_values(array_filter(
            $orders,
            fn ($order) => ($order['status'] ?? null) === 'delivered' && self::truthy($order['rider_email'] ?? null)
        ));

        $board = [];
        foreach ($riders as $rider) {
            $riderEmail = $rider['user_email'] ?? null;
            $earned = 0.0;
            foreach ($delivered as $order) {
                if (($order['rider_email'] ?? null) !== $riderEmail) continue;
                $earned += Fns::numberOr($order['rider_payout'] ?? 0, 0.0);
            }
            $paid = 0.0;
            foreach ($riderSettlements as $row) {
                if (($row['subject_email'] ?? null) !== $riderEmail) continue;
                if (($row['status'] ?? null) !== 'paid') continue;
                $paid += Fns::numberOr($row['net'] ?? 0, 0.0);
            }
            $board[] = [
                'email' => $riderEmail,
                'name' => $rider['full_name'] ?? null,
                'status' => $rider['status'] ?? null,
                'deliveries' => Fns::numberOr($rider['deliveries_count'] ?? 0, 0.0),
                'earned' => $earned,
                'paid' => $paid,
                'balance' => $earned - $paid,
                'cash' => Fns::numberOr($rider['cash_on_hand'] ?? 0, 0.0),
            ];
        }
        usort($board, fn ($a, $b) => $b['balance'] <=> $a['balance']);

        $totals = ['earned' => 0.0, 'paid' => 0.0, 'pending' => 0.0, 'cash' => 0.0];
        foreach ($board as $row) {
            $totals['earned'] += $row['earned'];
            $totals['paid'] += $row['paid'];
            $totals['cash'] += $row['cash'];
        }
        foreach ($riderSettlements as $row) {
            if (($row['status'] ?? null) === 'pending') {
                $totals['pending'] += Fns::numberOr($row['net'] ?? 0, 0.0);
            }
        }

        return ['board' => $board, 'totals' => $totals, 'settlements' => $riderSettlements];
    }

    /* ---------------------------------------------------------- delivery map */

    public static function adminFleetBoard(array $data, ?array $user): array
    {
        Fns::assertStaffRole($user ?? [], ['admin', 'ops', 'finance'], self::PERMISSION_MESSAGE);
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);

        $active = array_values(array_filter(
            $orders,
            fn ($order) => in_array($order['status'] ?? null, self::ACTIVE_STATUSES, true)
        ));
        $online = array_values(array_filter(
            $riders,
            fn ($rider) => self::truthy($rider['is_online'] ?? null) && ($rider['status'] ?? null) === 'approved'
        ));

        return [
            'deliveries' => array_map(fn ($order) => [
                'id' => $order['id'] ?? null,
                'code' => $order['code'] ?? null,
                'status' => $order['status'] ?? null,
                'store_name' => $order['store_name'] ?? null,
                'store_id' => $order['store_id'] ?? null,
                'address_area' => $order['address_area'] ?? null,
                'address_line' => $order['address_line'] ?? null,
                'rider_name' => $order['rider_name'] ?? null,
                'rider_email' => $order['rider_email'] ?? null,
                'total' => $order['total'] ?? null,
                'created_date' => $order['created_date'] ?? null,
            ], $active),
            'riderPositions' => array_map(fn ($rider) => [
                'name' => $rider['full_name'] ?? null,
                'email' => $rider['user_email'] ?? null,
                'zone' => $rider['zone'] ?? null,
                'deliveries' => Fns::numberOr($rider['deliveries_count'] ?? 0, 0.0),
            ], $online),
        ];
    }

    /* ---------------------------------------------------------- audit trail */

    public static function adminAuditTrail(array $data, ?array $user): array
    {
        Fns::assertStaffRole($user ?? [], ['admin'], self::PERMISSION_MESSAGE);
        return Store::filter('AuditLog', [], ['sort' => '-created_date', 'limit' => 250]);
    }

    /* -------------------------------------------------------- notifications */

    public static function notificationsFeed(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $orders = Store::filter('Order', ['customer_email' => $email], ['sort' => '-created_date', 'limit' => 25]);
        $existing = Store::filter('Notification', ['user_email' => $email], ['sort' => '-created_date', 'limit' => 120]);
        $stores = Store::filter(
            'Store',
            ['is_approved' => true, 'promo' => ['$exists' => true]],
            ['limit' => self::PROMO_STORES_LIMIT]
        );
        $riders = Store::filter('RiderProfile', ['user_email' => $email]);

        $known = [];
        foreach ($existing as $row) {
            $key = Fns::str($row['key'] ?? '');
            if ($key !== '') $known[$key] = true;
        }
        $pending = [];
        $push = static function (?string $key, array $payload) use (&$known, &$pending, $email): void {
            if ($key === null || $key === '' || isset($known[$key])) return;
            $known[$key] = true;
            $pending[] = $payload + ['user_email' => $email, 'key' => $key, 'is_read' => false];
        };

        foreach ($orders as $order) {
            foreach (self::listOf($order['timeline'] ?? null) as $entry) {
                if (!is_array($entry)) continue;
                $status = $entry['status'] ?? null;
                if ($status === 'placed') continue;
                $at = $entry['at'] ?? $order['updated_date'] ?? null;
                $label = is_string($status) ? (self::ORDER_STATUS_LABELS[$status] ?? $status) : Fns::str($status);
                $push(Fns::str($order['id'] ?? '') . ':' . Fns::str($status) . ':' . Fns::str($at), [
                    'kind' => 'order',
                    'title' => $label . ' · ' . Fns::str($order['store_name'] ?? ''),
                    'body' => (string) Fns::or(
                        $entry['note'] ?? null,
                        'Order ' . Fns::str($order['code'] ?? '') . ' is now ' . str_replace('_', ' ', Fns::str($status)) . '.'
                    ),
                    'link' => '/order-details?id=' . Fns::str($order['id'] ?? ''),
                    'order_code' => $order['code'] ?? null,
                ]);
            }
        }

        foreach ($stores as $store) {
            if (!self::truthy($store['promo'] ?? null)) continue;
            $push('promo:' . Fns::str($store['id'] ?? '') . ':' . Fns::str($store['promo']), [
                'kind' => 'promo',
                'title' => Fns::str($store['name'] ?? '') . ' — ' . Fns::str($store['promo']),
                'body' => 'A live offer from ' . Fns::str($store['name'] ?? '') . '. Tap to browse their menu.',
                'link' => '/store-menu?id=' . Fns::str($store['id'] ?? ''),
            ]);
        }

        $rider = $riders[0] ?? null;
        if ($rider && ($rider['status'] ?? null) !== 'approved') {
            $riderStatus = Fns::str($rider['status'] ?? '');
            $push('account:rider:' . $riderStatus, [
                'kind' => 'account',
                'title' => 'Rider account ' . $riderStatus,
                'body' => ($rider['status'] ?? null) === 'pending'
                    ? 'Your rider application is under review. We will notify you once it is approved.'
                    : 'Your rider account is ' . $riderStatus . ". Check your profile for the reviewer's note.",
                'link' => '/rider-profile',
            ]);
        }

        if ($pending) Store::bulkCreate('Notification', array_slice($pending, 0, 60));

        $all = Store::filter('Notification', ['user_email' => $email], ['sort' => '-created_date', 'limit' => 80]);
        $unread = 0;
        foreach ($all as $row) {
            if (!self::truthy($row['is_read'] ?? null)) $unread += 1;
        }
        return ['notifications' => $all, 'unread' => $unread];
    }

    public static function markNotificationRead(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'Invalid input');
        $record = Store::get('Notification', $id);
        if (Fns::str($record['user_email'] ?? '') !== $email) {
            Fns::fail(403, 'You cannot change this notification.');
        }
        return Store::update('Notification', $id, ['is_read' => true]);
    }

    public static function markAllNotificationsRead(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $mine = Store::filter('Notification', ['user_email' => $email, 'is_read' => false]);
        if ($mine) {
            Store::bulkUpdate(
                'Notification',
                array_map(fn ($row) => ['id' => $row['id'], 'is_read' => true], $mine)
            );
        }
        return ['updated' => count($mine)];
    }

    /* --------------------------------------------------------- rider schedule */

    public static function riderShifts(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $shifts = Store::filter('RiderShift', ['user_email' => $email], ['sort' => 'date', 'limit' => 80]);
        $riders = Store::filter('RiderProfile', ['user_email' => $email]);
        return ['shifts' => $shifts, 'rider' => $riders[0] ?? null];
    }

    public static function addRiderShift(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $date = Fns::str($data['date'] ?? '');
        $start = Fns::str($data['start_time'] ?? '');
        $end = Fns::str($data['end_time'] ?? '');
        if ($date === '' || $start === '' || $end === '') Fns::fail(400, 'Invalid input');

        $rider = Fns::findOne('RiderProfile', ['user_email' => $email]);
        if (!$rider) Fns::fail(403, 'Submit a rider application first.');

        foreach (Store::filter('RiderShift', ['user_email' => $email, 'date' => $date]) as $shift) {
            if (($shift['start_time'] ?? null) === $start) {
                Fns::fail(409, 'You already have a shift starting at that time.');
            }
        }

        $zone = Fns::str($data['zone'] ?? '');
        if ($zone === '') $zone = Fns::str($rider['zone'] ?? '');

        $payload = ['date' => $date, 'start_time' => $start, 'end_time' => $end];
        if (array_key_exists('zone', $data) && $data['zone'] !== null) $payload['zone'] = Fns::str($data['zone']);
        if (array_key_exists('note', $data) && $data['note'] !== null) $payload['note'] = Fns::str($data['note']);
        $payload['user_email'] = $email;
        $payload['rider_name'] = $rider['full_name'] ?? null;
        $payload['zone'] = $zone;
        $payload['status'] = 'planned';

        return Store::create('RiderShift', $payload);
    }

    public static function removeRiderShift(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $id = Fns::str($data['id'] ?? '');
        if ($id === '') Fns::fail(400, 'Invalid input');

        $shift = Store::get('RiderShift', $id);
        if (Fns::str($shift['user_email'] ?? '') !== $email) {
            Fns::fail(403, 'You cannot remove this shift.');
        }
        Store::delete('RiderShift', $id);
        return ['ok' => true];
    }

    /* ----------------------------------------------------------- rider docs */

    public static function saveRiderDocuments(array $data, ?array $user): array
    {
        $rider = Fns::myRider($user);
        if (!$rider) Fns::fail(403, 'Submit a rider application first.');

        $fields = [
            'full_name', 'phone', 'vehicle_type', 'plate_number', 'id_type', 'id_number',
            'id_document_uri', 'license_uri', 'vehicle_doc_uri', 'insurance_uri', 'insurance_expiry',
        ];
        $patch = [];
        foreach ($fields as $field) {
            if (!array_key_exists($field, $data) || $data[$field] === null) continue;
            $patch[$field] = Fns::str($data[$field]);
        }

        $hasDocs = false;
        foreach (['id_document_uri', 'license_uri', 'vehicle_doc_uri', 'insurance_uri'] as $key) {
            if (self::truthy($data[$key] ?? null)) {
                $hasDocs = true;
                break;
            }
        }

        $patch['docs_status'] = $hasDocs ? 'submitted' : ($rider['docs_status'] ?? 'missing');
        if ($hasDocs) {
            $patch['docs_submitted_at'] = Fns::nowIso();
        } elseif (array_key_exists('docs_submitted_at', $rider)) {
            $patch['docs_submitted_at'] = $rider['docs_submitted_at'];
        }

        return Store::update('RiderProfile', Fns::str($rider['id'] ?? ''), $patch);
    }

    /* --------------------------------------------------------- site content */

    public static function getSiteContent(array $data, ?array $user): array
    {
        $record = Fns::findOne('PlatformContent', [], ['sort' => '-updated_date', 'limit' => 1]);
        return [
            'id' => $record['id'] ?? null,
            'announcement_title' => $record['announcement_title'] ?? '',
            'announcement_body' => $record['announcement_body'] ?? '',
            'announcement_tone' => $record['announcement_tone'] ?? 'purple',
            'announcement_active' => $record['announcement_active'] ?? false,
            'banners' => $record['banners'] ?? [],
            'featured_categories' => $record['featured_categories'] ?? [],
        ];
    }

    public static function saveSiteContent(array $data, ?array $user): array
    {
        Fns::assertStaffRole($user ?? [], ['admin'], self::PERMISSION_MESSAGE);
        $existing = Fns::findOne('PlatformContent', [], ['sort' => '-updated_date', 'limit' => 1]);

        $payload = [];
        foreach (['announcement_title', 'announcement_body', 'announcement_tone', 'announcement_active', 'banners', 'featured_categories'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) $payload[$field] = $data[$field];
        }
        $payload['updated_by'] = Fns::userEmail($user);

        $saved = $existing
            ? Store::update('PlatformContent', Fns::str($existing['id'] ?? ''), $payload)
            : Store::create('PlatformContent', $payload);

        $banners = $data['banners'] ?? null;
        $categories = $data['featured_categories'] ?? null;
        $bannerCount = is_array($banners) ? count($banners) : 0;
        $categoryCount = is_array($categories) ? count($categories) : 0;
        Fns::audit(
            $user ?? [],
            'content.updated',
            'homepage',
            "Homepage content updated ({$bannerCount} banners, {$categoryCount} categories)",
            'info'
        );

        return $saved;
    }

    // --- helpers ---------------------------------------------------------

    /** Port of prepMinutes(): accepted → ready_for_pickup, in whole minutes. */
    private static function prepMinutes(array $order): ?int
    {
        $accepted = null;
        $ready = null;
        foreach (self::listOf($order['timeline'] ?? null) as $entry) {
            if (!is_array($entry)) continue;
            $status = $entry['status'] ?? null;
            if ($accepted === null && $status === 'accepted') $accepted = $entry;
            if ($ready === null && $status === 'ready_for_pickup') $ready = $entry;
        }
        if ($accepted === null || $ready === null) return null;
        $from = Fns::timeMs($accepted['at'] ?? null);
        $to = Fns::timeMs($ready['at'] ?? null);
        if ($from === null || $to === null) return null;
        return self::jsRound(($to - $from) / 60000);
    }

    /** JS Math.round() (halves round up, as the JS values here are non-negative). */
    private static function jsRound(float $value): int
    {
        return (int) floor($value + 0.5);
    }

    /** `Math.round((sum / count) * 10) / 10`, or null for an empty list. */
    private static function average1(array $values): ?float
    {
        if (!$values) return null;
        $sum = 0.0;
        foreach ($values as $value) $sum += Fns::numberOr($value, 0.0);
        return self::jsRound(($sum / count($values)) * 10) / 10;
    }

    /** JS truthiness: only null, false, 0, NaN and "" are falsy. */
    private static function truthy(mixed $value): bool
    {
        if ($value === null || $value === false) return false;
        if (is_int($value) || is_float($value)) return $value != 0.0;
        if (is_string($value)) return $value !== '';
        return true;
    }

    /** @return array<int,mixed> */
    private static function listOf(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }

    private function __construct() {}
}
