<?php
// Port of src/lib/avora-fns.js: role consoles, admin boards and support desks.
declare(strict_types=1);

final class AvoraFns
{
    public const ROLE_PERMISSIONS = [
        'admin' => ['orders.view', 'verification.manage', 'finance.view', 'finance.manage', 'reports.view', 'support.manage', 'backup.run'],
        'ops' => ['orders.view', 'verification.manage', 'support.manage'],
        'finance' => ['orders.view', 'finance.view', 'finance.manage'],
        'support' => ['orders.view', 'support.manage'],
        'customer' => [],
    ];

    private const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'rider_assigned', 'picked_up'];

    private const TRANSITIONS = [
        'accept' => ['from' => ['placed'], 'to' => 'accepted', 'actor' => 'vendor'],
        'reject' => ['from' => ['placed', 'accepted'], 'to' => 'cancelled', 'actor' => 'vendor'],
        'preparing' => ['from' => ['accepted'], 'to' => 'preparing', 'actor' => 'vendor'],
        'ready' => ['from' => ['preparing'], 'to' => 'ready_for_pickup', 'actor' => 'vendor'],
        'pickup' => ['from' => ['rider_assigned', 'ready_for_pickup'], 'to' => 'picked_up', 'actor' => 'rider'],
        'deliver' => ['from' => ['picked_up'], 'to' => 'delivered', 'actor' => 'rider'],
        'fail' => ['from' => ['picked_up', 'rider_assigned'], 'to' => 'failed', 'actor' => 'rider'],
        'cancel' => ['from' => ['placed', 'accepted'], 'to' => 'cancelled', 'actor' => 'customer'],
    ];

    private const PRIORITY_WEIGHT = ['urgent' => 0, 'high' => 1, 'normal' => 2];

    public static function registry(): array
    {
        return [
            'avora/getConsoleContext' => ['auth' => true, 'run' => [self::class, 'getConsoleContext']],
            'avora/adminOverview' => ['auth' => true, 'run' => [self::class, 'adminOverview']],
            'avora/adminOrders' => ['auth' => true, 'run' => [self::class, 'adminOrders']],
            'avora/adminVerifications' => ['auth' => true, 'run' => [self::class, 'adminVerifications']],
            'avora/reviewStore' => ['auth' => true, 'run' => [self::class, 'reviewStore']],
            'avora/reviewRider' => ['auth' => true, 'run' => [self::class, 'reviewRider']],
            'avora/adminFinance' => ['auth' => true, 'run' => [self::class, 'adminFinance']],
            'avora/decideRefund' => ['auth' => true, 'run' => [self::class, 'decideRefund']],
            'avora/runSettlements' => ['auth' => true, 'run' => [self::class, 'runSettlements']],
            'avora/markSettlementPaid' => ['auth' => true, 'run' => [self::class, 'markSettlementPaid']],
            'avora/adminReports' => ['auth' => true, 'run' => [self::class, 'adminReports']],
            'avora/adminAnalytics' => ['auth' => true, 'run' => [self::class, 'adminAnalytics']],
            'avora/runBackup' => ['auth' => true, 'run' => [self::class, 'runBackup']],
            'avora/advanceOrder' => ['auth' => true, 'run' => [self::class, 'advanceOrder']],
            'avora/claimDelivery' => ['auth' => true, 'run' => [self::class, 'claimDelivery']],
            'avora/availableJobs' => ['auth' => true, 'run' => [self::class, 'availableJobs']],
            'avora/setRiderOnline' => ['auth' => true, 'run' => [self::class, 'setRiderOnline']],
            'avora/supportQueue' => ['auth' => true, 'run' => [self::class, 'supportQueue']],
            'avora/replyTicket' => ['auth' => true, 'run' => [self::class, 'replyTicket']],
            'avora/closeTicket' => ['auth' => true, 'run' => [self::class, 'closeTicket']],
            'avora/supportTicketBoard' => ['auth' => true, 'run' => [self::class, 'supportTicketBoard']],
            'avora/setTicketState' => ['auth' => true, 'run' => [self::class, 'setTicketState']],
            'avora/supportDashboard' => ['auth' => true, 'run' => [self::class, 'supportDashboard']],
            'avora/adminStaffBoard' => ['auth' => true, 'run' => [self::class, 'adminStaffBoard']],
            'avora/saveStaffMember' => ['auth' => true, 'run' => [self::class, 'saveStaffMember']],
            'avora/removeStaffMember' => ['auth' => true, 'run' => [self::class, 'removeStaffMember']],
        ];
    }

    /* -------------------------------------------------------------- context */

    private static function roleOf(?array $user): string
    {
        if (($user['role'] ?? null) === 'admin') return 'admin';
        return Fns::staffRole($user ?? []);
    }

    private static function guard(?array $user, string $permission): string
    {
        $role = self::roleOf($user);
        if (!in_array($permission, self::ROLE_PERMISSIONS[$role] ?? [], true)) {
            Fns::fail(403, 'You do not have permission to open this area.');
        }
        return $role;
    }

    private static function requireAdmin(?array $user): void
    {
        if (self::roleOf($user) !== 'admin') {
            Fns::fail(403, 'Only administrators can manage staff access.');
        }
    }

    public static function getConsoleContext(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $role = self::roleOf($user);

        return [
            'user' => [
                'id' => $user['id'] ?? null,
                'email' => $email,
                'full_name' => $user['full_name'] ?? '',
                'role' => $user['role'] ?? null,
            ],
            'role' => $role,
            'permissions' => self::ROLE_PERMISSIONS[$role] ?? [],
            'store' => Fns::myStore($user ?? []),
            'rider' => Fns::myRider($user ?? []),
        ];
    }

    /* ---------------------------------------------------------------- admin */

    public static function adminOverview(array $data, ?array $user): array
    {
        self::guard($user, 'orders.view');
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 100]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);
        $tickets = Store::filter('SupportTicket', [], ['sort' => '-created_date', 'limit' => 100]);
        $refunds = Store::filter('Refund', [], ['sort' => '-created_date', 'limit' => 100]);

        $today = Fns::dayKey(Fns::nowIso());
        $active = array_values(array_filter(
            $orders,
            fn ($order) => in_array($order['status'] ?? null, self::ACTIVE_STATUSES, true)
        ));
        $now = microtime(true) * 1000;
        $stale = array_values(array_filter($active, function ($order) use ($now) {
            $created = Fns::timeMs($order['created_date'] ?? null);
            return $created !== null && $now - $created > 45 * 60 * 1000;
        }));

        $exceptions = array_merge(
            array_slice(array_values(array_filter(
                $orders,
                fn ($order) => in_array($order['status'] ?? null, ['failed', 'cancelled'], true)
            )), 0, 5),
            $stale
        );

        $gmvToday = 0.0;
        $ordersToday = 0;
        foreach ($orders as $order) {
            $isToday = Fns::dayKey($order['created_date'] ?? null) === $today;
            if ($isToday) $ordersToday++;
            if ($isToday && ($order['status'] ?? null) === 'delivered') {
                $gmvToday += self::num($order['total'] ?? null);
            }
        }

        return [
            'gmvToday' => $gmvToday,
            'ordersToday' => $ordersToday,
            'activeOrders' => count($active),
            'exceptions' => array_slice($exceptions, 0, 6),
            'pendingStores' => count(array_filter($stores, fn ($store) => empty($store['is_approved']))),
            'pendingRiders' => count(array_filter($riders, fn ($rider) => ($rider['status'] ?? null) === 'pending')),
            'ridersOnline' => count(array_filter(
                $riders,
                fn ($rider) => !empty($rider['is_online']) && ($rider['status'] ?? null) === 'approved'
            )),
            'openTickets' => count(array_filter($tickets, fn ($ticket) => ($ticket['status'] ?? null) !== 'closed')),
            'pendingRefunds' => count(array_filter($refunds, fn ($refund) => ($refund['status'] ?? null) === 'requested')),
            'recentOrders' => array_slice($orders, 0, 8),
        ];
    }

    public static function adminOrders(array $data, ?array $user): array
    {
        self::guard($user, 'orders.view');
        $status = Fns::str($data['status'] ?? '');
        if ($status !== '') {
            return Store::filter('Order', ['status' => $status], ['sort' => '-created_date', 'limit' => 100]);
        }
        return Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 100]);
    }

    public static function adminVerifications(array $data, ?array $user): array
    {
        self::guard($user, 'verification.manage');
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 100]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);
        $charges = Store::filter('VendorCharge', [], ['sort' => '-created_date', 'limit' => 300]);

        $withFees = array_map(function ($store) use ($charges) {
            $mine = array_values(array_filter($charges, fn ($charge) => ($charge['store_id'] ?? null) === ($store['id'] ?? null)));
            $feePaid = !empty($store['join_fee_paid'])
                || count(array_filter(
                    $mine,
                    fn ($charge) => ($charge['kind'] ?? null) === 'join_fee' && ($charge['status'] ?? null) === 'paid'
                )) > 0;
            $feeDue = 0.0;
            foreach ($mine as $charge) {
                if (($charge['status'] ?? null) === 'due') $feeDue += self::num($charge['amount'] ?? null);
            }
            return array_merge($store, ['feePaid' => $feePaid, 'feeDue' => $feeDue]);
        }, $stores);

        return [
            'stores' => array_values(array_filter($withFees, fn ($store) => empty($store['is_approved']))),
            'approvedStores' => array_values(array_filter($withFees, fn ($store) => !empty($store['is_approved']))),
            'riders' => array_values(array_filter($riders, fn ($rider) => ($rider['status'] ?? null) === 'pending')),
            'reviewedRiders' => array_values(array_filter($riders, fn ($rider) => ($rider['status'] ?? null) !== 'pending')),
        ];
    }

    public static function reviewStore(array $data, ?array $user): array
    {
        self::guard($user, 'verification.manage');
        $storeId = Fns::str($data['store_id'] ?? '');
        if ($storeId === '') Fns::fail(400, 'Choose a store.');
        $decision = Fns::str($data['decision'] ?? '');
        if (!in_array($decision, ['approve', 'reject'], true)) Fns::fail(400, 'Choose approve or reject.');
        $approved = $decision === 'approve';
        $note = array_key_exists('note', $data) && $data['note'] !== null ? Fns::str($data['note']) : null;

        $current = Store::get('Store', $storeId);
        if ($approved && empty($current['join_fee_paid'])) {
            $fees = Fns::loadFees();
            Fns::fail(409, 'Collect the ₦' . number_format((float) $fees['joinFee'], 0, '.', ',')
                . ' joining and registration fee before approving this vendor. Record it under Finance → Vendor fees.');
        }

        $store = Store::update('Store', $storeId, [
            'is_approved' => $approved,
            'is_open' => $approved,
            'review_note' => $note ?? ($approved ? 'Approved' : 'Rejected'),
        ]);
        Fns::audit(
            $user ?? [],
            $approved ? 'vendor.approved' : 'vendor.rejected',
            $store['name'] ?? null,
            'Vendor verification ' . $decision . 'd by ' . Fns::userEmail($user),
            $approved ? 'info' : 'warning'
        );
        return $store;
    }

    public static function reviewRider(array $data, ?array $user): array
    {
        self::guard($user, 'verification.manage');
        $riderId = Fns::str($data['rider_id'] ?? '');
        if ($riderId === '') Fns::fail(400, 'Choose a rider.');
        $decision = Fns::str($data['decision'] ?? '');
        if (!in_array($decision, ['approve', 'reject', 'suspend'], true)) Fns::fail(400, 'Choose approve, reject or suspend.');
        $note = array_key_exists('note', $data) && $data['note'] !== null ? Fns::str($data['note']) : null;

        $status = $decision === 'approve' ? 'approved' : ($decision === 'reject' ? 'rejected' : 'suspended');
        $patch = ['status' => $status];
        if ($status !== 'approved') $patch['is_online'] = false;
        if ($note !== null) {
            $patch['review_note'] = $note;
        } else {
            $patch['$unset'] = ['review_note' => true];
        }

        $rider = Store::update('RiderProfile', $riderId, $patch);
        Fns::audit(
            $user ?? [],
            'rider.' . $status,
            $rider['full_name'] ?? null,
            'Rider verification set to ' . $status . ' by ' . Fns::userEmail($user),
            $status === 'approved' ? 'info' : 'warning'
        );
        return $rider;
    }

    /* -------------------------------------------------------------- finance */

    public static function adminFinance(array $data, ?array $user): array
    {
        self::guard($user, 'finance.view');
        $payments = Store::filter('Payment', [], ['sort' => '-created_date', 'limit' => 200]);
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);
        $refunds = Store::filter('Refund', [], ['sort' => '-created_date', 'limit' => 100]);
        $settlements = Store::filter('Settlement', [], ['sort' => '-created_date', 'limit' => 100]);
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 100]);

        $card = 0.0;
        $cash = 0.0;
        foreach ($payments as $payment) {
            $method = $payment['method'] ?? null;
            $status = $payment['status'] ?? null;
            if ($method === 'card' && $status === 'paid') $card += self::num($payment['amount'] ?? null);
            if ($method === 'cash' && in_array($status, ['paid', 'cash_collected'], true)) {
                $cash += self::num($payment['amount'] ?? null);
            }
        }

        $refunded = 0.0;
        foreach ($refunds as $refund) {
            if (in_array($refund['status'] ?? null, ['approved', 'processed'], true)) {
                $refunded += self::num($refund['amount'] ?? null);
            }
        }

        $delivered = array_values(array_filter($orders, fn ($order) => ($order['status'] ?? null) === 'delivered'));
        $fees = Fns::loadFees();
        $vendorCommission = 0.0;
        $riderCommission = 0.0;
        $deliveredRevenue = 0.0;
        foreach ($delivered as $order) {
            $rate = $fees['vendorPct'] / 100;
            foreach ($stores as $store) {
                if (($store['id'] ?? null) === ($order['store_id'] ?? null)) {
                    $configured = Fns::number($store['commission_rate'] ?? null);
                    if ($configured !== null) $rate = $configured;
                    break;
                }
            }
            $vendorCommission += round(self::num($order['subtotal'] ?? null) * $rate);
            $riderCommission += round(self::num($order['delivery_fee'] ?? null) * ($fees['riderPct'] / 100));
            $deliveredRevenue += self::num($order['total'] ?? null);
        }

        $payoutsPending = 0.0;
        foreach ($settlements as $settlement) {
            if (($settlement['status'] ?? null) === 'pending') $payoutsPending += self::num($settlement['net'] ?? null);
        }

        $mismatches = array_values(array_filter(
            $delivered,
            fn ($order) => ($order['payment_status'] ?? null) !== 'paid' && empty($order['cash_collected'])
        ));

        return [
            'card' => $card,
            'cash' => $cash,
            'refunded' => $refunded,
            'fees' => $fees,
            'vendorCommission' => $vendorCommission,
            'riderCommission' => $riderCommission,
            'commission' => $vendorCommission + $riderCommission,
            'deliveredRevenue' => $deliveredRevenue,
            'payoutsPending' => $payoutsPending,
            'mismatches' => $mismatches,
            'payments' => array_slice($payments, 0, 40),
            'refunds' => array_values(array_filter($refunds, fn ($refund) => ($refund['status'] ?? null) === 'requested')),
            'allRefunds' => array_slice($refunds, 0, 20),
            'settlements' => array_slice($settlements, 0, 40),
        ];
    }

    public static function decideRefund(array $data, ?array $user): array
    {
        self::guard($user, 'finance.manage');
        $refundId = Fns::str($data['refund_id'] ?? '');
        if ($refundId === '') Fns::fail(400, 'Choose a refund.');
        $decision = Fns::str($data['decision'] ?? '');
        if (!in_array($decision, ['approve', 'reject'], true)) Fns::fail(400, 'Choose approve or reject.');
        $note = array_key_exists('note', $data) && $data['note'] !== null ? Fns::str($data['note']) : null;
        $approved = $decision === 'approve';

        $refund = Store::get('Refund', $refundId);
        Store::update('Refund', $refundId, [
            'status' => $approved ? 'processed' : 'rejected',
            'decided_by' => Fns::userEmail($user),
            'note' => $note ?? '',
        ]);

        $target = Fns::or($refund['order_code'] ?? null, $refund['order_id'] ?? null);
        if ($approved) {
            $orderId = Fns::str($refund['order_id'] ?? '');
            if ($orderId !== '') {
                Store::update('Order', $orderId, ['payment_status' => 'refunded']);
                $payments = Store::filter('Payment', ['order_id' => $orderId]);
                if ($payments) {
                    Store::update('Payment', (string) $payments[0]['id'], [
                        'status' => 'refunded',
                        'note' => 'Refund ' . $refundId,
                    ]);
                }
            }
            Fns::audit(
                $user ?? [],
                'refund.processed',
                $target,
                'Refund of ' . Fns::ngn($refund['amount'] ?? 0) . ' approved by ' . Fns::userEmail($user),
                'warning'
            );
        } else {
            Fns::audit($user ?? [], 'refund.rejected', $target, $note ?? 'Rejected', 'info');
        }
        return ['ok' => true];
    }

    public static function runSettlements(array $data, ?array $user): array
    {
        self::guard($user, 'finance.manage');
        $days = (int) (Fns::number($data['days'] ?? null) ?? 7);
        if ($days < 1 || $days > 90) Fns::fail(400, 'Choose between 1 and 90 days.');

        $since = gmdate('Y-m-d\TH:i:s.000\Z', (int) floor(microtime(true) - $days * 86400));
        $orders = array_values(array_filter(
            Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 300]),
            fn ($order) => ($order['status'] ?? null) === 'delivered'
                && strcmp(Fns::str($order['created_date'] ?? ''), $since) >= 0
        ));
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 100]);
        $fees = Fns::loadFees();
        FinanceFns::ensureVendorCharges();
        $openCharges = array_values(array_filter(
            Store::filter('VendorCharge', [], ['sort' => '-created_date', 'limit' => 400]),
            fn ($charge) => ($charge['status'] ?? null) === 'due'
        ));

        $vendorBuckets = [];
        $riderBuckets = [];
        foreach ($orders as $order) {
            $owner = Fns::str($order['owner_email'] ?? '');
            if ($owner !== '') {
                if (!isset($vendorBuckets[$owner])) {
                    $vendorBuckets[$owner] = ['name' => $order['store_name'] ?? null, 'orders' => 0, 'gross' => 0.0];
                }
                $vendorBuckets[$owner]['orders']++;
                $vendorBuckets[$owner]['gross'] += self::num($order['subtotal'] ?? null);
            }
            $rider = Fns::str($order['rider_email'] ?? '');
            if ($rider !== '') {
                if (!isset($riderBuckets[$rider])) {
                    $riderBuckets[$rider] = ['name' => $order['rider_name'] ?? null, 'orders' => 0, 'gross' => 0.0];
                }
                $riderBuckets[$rider]['orders']++;
                $riderBuckets[$rider]['gross'] += self::num($order['delivery_fee'] ?? null);
            }
        }

        $created = [];
        $periodStart = substr($since, 0, 10);
        $periodEnd = Fns::dayKey(Fns::nowIso());
        foreach ($vendorBuckets as $email => $bucket) {
            $rate = $fees['vendorPct'] / 100;
            foreach ($stores as $store) {
                if (($store['owner_email'] ?? null) === $email) {
                    $configured = Fns::number($store['commission_rate'] ?? null);
                    if ($configured !== null) $rate = $configured;
                    break;
                }
            }
            $commission = (int) round($bucket['gross'] * $rate);

            // The joining fee and the monthly subscription come out of the payout.
            $owed = array_values(array_filter($openCharges, fn ($charge) => ($charge['owner_email'] ?? null) === $email));
            usort($owed, fn ($a, $b) => (($a['kind'] ?? null) === 'join_fee' ? 0 : 1) - (($b['kind'] ?? null) === 'join_fee' ? 0 : 1));
            $remaining = $bucket['gross'] - $commission;
            $deductions = 0.0;
            $cleared = [];
            foreach ($owed as $charge) {
                $amount = self::num($charge['amount'] ?? null);
                if ($amount > $remaining) continue;
                $remaining -= $amount;
                $deductions += $amount;
                $cleared[] = $charge;
            }

            $reference = 'STM-' . substr((string) round(microtime(true) * 1000), -6);
            $settlement = Store::create('Settlement', [
                'subject_type' => 'vendor',
                'subject_email' => $email,
                'subject_name' => $bucket['name'],
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'orders_count' => $bucket['orders'],
                'gross' => $bucket['gross'],
                'commission' => $commission,
                'deductions' => $deductions,
                'net' => $remaining,
                'status' => 'pending',
                'reference' => $reference,
                'notes' => $cleared
                    ? 'Deducted ' . implode(', ', array_map(fn ($charge) => Fns::str($charge['reference'] ?? ''), $cleared))
                    : '',
            ]);
            $created[] = $settlement;

            foreach ($cleared as $charge) {
                Store::update('VendorCharge', (string) $charge['id'], [
                    'status' => 'paid',
                    'paid_at' => Fns::nowIso(),
                    'settlement_id' => $settlement['id'],
                    'note' => 'Deducted from settlement ' . $reference,
                ]);
            }
        }

        foreach ($riderBuckets as $email => $bucket) {
            $commission = (int) round($bucket['gross'] * ($fees['riderPct'] / 100));
            $created[] = Store::create('Settlement', [
                'subject_type' => 'rider',
                'subject_email' => $email,
                'subject_name' => $bucket['name'],
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'orders_count' => $bucket['orders'],
                'gross' => $bucket['gross'],
                'commission' => $commission,
                'deductions' => 0,
                'net' => $bucket['gross'] - $commission,
                'status' => 'pending',
                'reference' => 'STM-' . substr((string) round(microtime(true) * 1000), -6),
            ]);
        }

        Fns::audit($user ?? [], 'settlements.generated', count($created) . ' statements', 'Last ' . $days . ' days');
        return $created;
    }

    public static function markSettlementPaid(array $data, ?array $user): array
    {
        self::guard($user, 'finance.manage');
        $updated = Store::update('Settlement', Fns::str($data['settlement_id'] ?? ''), ['status' => 'paid']);
        Fns::audit(
            $user ?? [],
            'settlement.paid',
            $updated['subject_name'] ?? null,
            Fns::ngn($updated['net'] ?? 0) . ' paid out',
            'info'
        );
        return $updated;
    }

    /* -------------------------------------------------------------- reports */

    public static function adminReports(array $data, ?array $user): array
    {
        self::guard($user, 'reports.view');
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 300]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);
        $auditLogs = Store::filter('AuditLog', [], ['sort' => '-created_date', 'limit' => 40]);

        $days = [];
        $anchor = gmmktime(0, 0, 0, (int) gmdate('n'), (int) gmdate('j'), (int) gmdate('Y'));
        for ($i = 13; $i >= 0; $i -= 1) {
            $key = gmdate('Y-m-d', $anchor - $i * 86400);
            $dayOrders = array_values(array_filter($orders, fn ($order) => Fns::dayKey($order['created_date'] ?? null) === $key));
            $gmv = 0.0;
            foreach ($dayOrders as $order) {
                if (($order['status'] ?? null) === 'delivered') $gmv += self::num($order['total'] ?? null);
            }
            $days[] = ['date' => substr($key, 5), 'orders' => count($dayOrders), 'gmv' => $gmv];
        }

        $storeMap = [];
        foreach ($orders as $order) {
            $name = Fns::str($order['store_name'] ?? '');
            if (!isset($storeMap[$name])) $storeMap[$name] = ['name' => $order['store_name'] ?? null, 'orders' => 0, 'gmv' => 0.0];
            $storeMap[$name]['orders']++;
            $storeMap[$name]['gmv'] += self::num($order['total'] ?? null);
        }
        $topStores = array_values($storeMap);
        usort($topStores, fn ($a, $b) => $b['gmv'] <=> $a['gmv']);

        $riderRows = array_map(fn ($rider) => [
            'name' => $rider['full_name'] ?? null,
            'deliveries' => $rider['deliveries_count'] ?? 0,
            'rating' => $rider['rating'] ?? 5,
            'online' => !empty($rider['is_online']),
            'status' => $rider['status'] ?? null,
            'cash' => $rider['cash_on_hand'] ?? 0,
        ], $riders);
        usort($riderRows, fn ($a, $b) => self::num($b['deliveries']) <=> self::num($a['deliveries']));

        return [
            'days' => $days,
            'topStores' => array_slice($topStores, 0, 6),
            'riders' => array_slice($riderRows, 0, 8),
            'auditLogs' => $auditLogs,
            'backups' => array_values(array_filter($auditLogs, fn ($log) => ($log['action'] ?? null) === 'backup.run')),
            'critical' => count(array_filter($auditLogs, fn ($log) => ($log['severity'] ?? null) === 'critical')),
        ];
    }

    public static function adminAnalytics(array $data, ?array $user): array
    {
        self::guard($user, 'reports.view');
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 400]);
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 100]);
        $riders = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 100]);

        $delivered = array_values(array_filter($orders, fn ($order) => ($order['status'] ?? null) === 'delivered'));
        $live = array_values(array_filter(
            $orders,
            fn ($order) => in_array($order['status'] ?? null, self::ACTIVE_STATUSES, true)
        ));

        $days = [];
        $anchor = gmmktime(0, 0, 0, (int) gmdate('n'), (int) gmdate('j'), (int) gmdate('Y'));
        for ($i = 13; $i >= 0; $i -= 1) {
            $key = gmdate('Y-m-d', $anchor - $i * 86400);
            $dayOrders = array_values(array_filter($orders, fn ($order) => Fns::dayKey($order['created_date'] ?? null) === $key));
            $gmv = 0.0;
            foreach ($dayOrders as $order) {
                if (($order['status'] ?? null) === 'delivered') $gmv += self::num($order['total'] ?? null);
            }
            $days[] = ['date' => substr($key, 5), 'orders' => count($dayOrders), 'gmv' => $gmv];
        }

        $months = [];
        [$year, $month] = array_map('intval', explode('-', gmdate('Y-m')));
        for ($i = 5; $i >= 0; $i -= 1) {
            $time = gmmktime(0, 0, 0, $month - $i, 1, $year);
            $key = gmdate('Y-m', $time);
            $monthOrders = array_values(array_filter($orders, fn ($order) => substr(Fns::str($order['created_date'] ?? ''), 0, 7) === $key));
            $gmv = 0.0;
            foreach ($monthOrders as $order) {
                if (($order['status'] ?? null) === 'delivered') $gmv += self::num($order['total'] ?? null);
            }
            $months[] = [
                'key' => $key,
                'month' => gmdate('M', $time),
                'orders' => count($monthOrders),
                'gmv' => $gmv,
            ];
        }

        $firstSeen = [];
        foreach (array_reverse($orders) as $order) {
            $email = Fns::str($order['customer_email'] ?? '');
            if ($email !== '' && !array_key_exists($email, $firstSeen)) {
                $firstSeen[$email] = substr(Fns::str($order['created_date'] ?? ''), 0, 7);
            }
        }
        foreach ($months as $index => $bucket) {
            $months[$index]['customers'] = count(array_filter($firstSeen, fn ($key) => $key === $bucket['key']));
        }

        $statusMap = [];
        foreach ($orders as $order) {
            $status = Fns::str($order['status'] ?? '');
            $statusMap[$status] = ($statusMap[$status] ?? 0) + 1;
        }

        $storeMap = [];
        foreach ($orders as $order) {
            $name = Fns::str($order['store_name'] ?? '');
            if (!isset($storeMap[$name])) $storeMap[$name] = ['name' => $order['store_name'] ?? null, 'orders' => 0, 'gmv' => 0.0];
            $storeMap[$name]['orders']++;
            $storeMap[$name]['gmv'] += self::num($order['total'] ?? null);
        }
        $topStores = array_values($storeMap);
        usort($topStores, fn ($a, $b) => $b['gmv'] <=> $a['gmv']);

        $gmv = 0.0;
        foreach ($delivered as $order) $gmv += self::num($order['total'] ?? null);

        $statusMix = [];
        foreach ($statusMap as $status => $count) {
            $statusMix[] = ['status' => $status, 'count' => $count];
        }

        return [
            'totals' => [
                'gmv' => $gmv,
                'orders' => count($orders),
                'active' => count($live),
                'customers' => count($firstSeen),
                'stores' => count(array_filter($stores, fn ($store) => !empty($store['is_approved']))),
                'ridersOnline' => count(array_filter(
                    $riders,
                    fn ($rider) => !empty($rider['is_online']) && ($rider['status'] ?? null) === 'approved'
                )),
                'avgOrder' => $delivered ? (int) round($gmv / count($delivered)) : 0,
            ],
            'days' => $days,
            'months' => $months,
            'statusMix' => $statusMix,
            'topStores' => array_slice($topStores, 0, 6),
        ];
    }

    public static function runBackup(array $data, ?array $user): array
    {
        self::guard($user, 'backup.run');
        $snapshot = [
            'at' => Fns::nowIso(),
            'orders' => Store::count('Order'),
            'stores' => Store::count('Store'),
            'products' => Store::count('Product'),
            'riders' => Store::count('RiderProfile'),
            'payments' => Store::count('Payment'),
        ];
        Store::create('AuditLog', [
            'actor_email' => Fns::userEmail($user),
            'action' => 'backup.run',
            'target' => 'full-snapshot',
            'detail' => json_encode($snapshot, JSON_UNESCAPED_SLASHES),
            'severity' => 'info',
        ]);
        return $snapshot;
    }

    /* ----------------------------------------------------------- order flow */

    public static function advanceOrder(array $data, ?array $user): array
    {
        $orderId = Fns::str($data['order_id'] ?? '');
        if ($orderId === '') Fns::fail(400, 'Choose an order.');
        $action = Fns::str($data['action'] ?? '');
        $rule = self::TRANSITIONS[$action] ?? null;
        $note = array_key_exists('note', $data) && $data['note'] !== null ? Fns::str($data['note']) : null;

        $order = Store::get('Order', $orderId);
        if (!$rule) Fns::fail(400, 'Unknown action');

        $status = Fns::str($order['status'] ?? '');
        if (!in_array($status, $rule['from'], true)) {
            Fns::fail(409, 'This order is ' . $status . ' and can no longer be ' . $action . 'ed.');
        }

        $email = Fns::userEmail($user);
        $isAdmin = ($user['role'] ?? null) === 'admin' || self::roleOf($user) === 'ops';
        $allowed = $isAdmin
            || ($rule['actor'] === 'vendor' && ($order['owner_email'] ?? null) === $email)
            || ($rule['actor'] === 'rider' && ($order['rider_email'] ?? null) === $email)
            || ($rule['actor'] === 'customer' && ($order['customer_email'] ?? null) === $email);
        if (!$allowed) Fns::fail(403, 'You cannot update this order.');

        $timeline = is_array($order['timeline'] ?? null) ? $order['timeline'] : [];
        $timeline[] = ['status' => $rule['to'], 'at' => Fns::nowIso(), 'note' => $note ?? '', 'by' => $email];
        $patch = ['status' => $rule['to'], 'timeline' => $timeline];

        if ($action === 'reject' || $action === 'cancel') {
            $patch['cancel_reason'] = $note ?? 'Cancelled';
            if (($order['payment_status'] ?? null) === 'paid') $patch['payment_status'] = 'refunded';
        }
        if ($action === 'deliver') {
            $at = Fns::nowIso();
            $patch['delivered_at'] = $at;
            $patch['payment_status'] = 'paid';
            if (($order['payment_method'] ?? null) === 'cash') $patch['cash_collected'] = true;
            $riders = Store::filter('RiderProfile', ['user_email' => $order['rider_email'] ?? '']);
            if ($riders) {
                Store::update('RiderProfile', (string) $riders[0]['id'], [
                    'deliveries_count' => self::num($riders[0]['deliveries_count'] ?? null) + 1,
                    'cash_on_hand' => self::num($riders[0]['cash_on_hand'] ?? null)
                        + (($order['payment_method'] ?? null) === 'cash' ? self::num($order['total'] ?? null) : 0),
                ]);
            }
        }
        if ($action === 'fail') {
            $patch['failure_reason'] = $note ?? 'Delivery failed';
            if (($order['payment_status'] ?? null) === 'paid') $patch['payment_status'] = 'refunded';
        }

        $updated = Store::update('Order', $orderId, $patch);
        $code = Fns::str($order['code'] ?? '');
        Fns::audit(
            $user ?? [],
            'order.' . $rule['to'],
            $order['code'] ?? null,
            $note !== null && $note !== '' ? $note . ' (' . $code . ')' : 'Order ' . $code . ' → ' . $rule['to'],
            in_array($action, ['fail', 'reject', 'cancel'], true) ? 'warning' : 'info'
        );
        return $updated;
    }

    public static function claimDelivery(array $data, ?array $user): array
    {
        $rider = Fns::myRider($user ?? []);
        if (!$rider || ($rider['status'] ?? null) !== 'approved') {
            Fns::fail(403, 'Your rider account is not approved yet.');
        }
        $orderId = Fns::str($data['order_id'] ?? '');
        if ($orderId === '') Fns::fail(400, 'Choose a delivery.');
        $order = Store::get('Order', $orderId);
        $email = Fns::userEmail($user);

        if (Fns::str($order['rider_email'] ?? '') !== '' && ($order['rider_email'] ?? null) !== $email) {
            Fns::fail(409, 'Another rider already accepted this job.');
        }
        if (($order['status'] ?? null) !== 'ready_for_pickup') {
            Fns::fail(409, 'This order is not ready for pickup yet.');
        }

        $timeline = is_array($order['timeline'] ?? null) ? $order['timeline'] : [];
        $timeline[] = ['status' => 'rider_assigned', 'at' => Fns::nowIso(), 'note' => 'Rider assigned', 'by' => $email];
        $fees = Fns::loadFees();

        $updated = Store::update('Order', $orderId, [
            'rider_email' => $email,
            'rider_name' => $rider['full_name'] ?? '',
            'rider_phone' => $rider['phone'] ?? '',
            'rider_payout' => (int) round(
                (self::num($order['delivery_fee'] ?? null) ?: 400) * (1 - $fees['riderPct'] / 100)
            ),
            'status' => 'rider_assigned',
            'timeline' => $timeline,
        ]);
        Store::update('RiderProfile', (string) $rider['id'], ['is_online' => true]);
        return $updated;
    }

    public static function availableJobs(array $data, ?array $user): array
    {
        $rider = Fns::myRider($user ?? []);
        if (!$rider || ($rider['status'] ?? null) !== 'approved') return [];

        $jobs = Store::filter('Order', ['status' => 'ready_for_pickup'], ['sort' => 'created_date', 'limit' => 30]);
        $out = [];
        foreach ($jobs as $job) {
            if (Fns::str($job['rider_email'] ?? '') !== '') continue;
            $out[] = [
                'id' => $job['id'] ?? null,
                'code' => $job['code'] ?? null,
                'store_name' => $job['store_name'] ?? null,
                'address_area' => $job['address_area'] ?? null,
                'address_line' => $job['address_line'] ?? null,
                'total' => $job['total'] ?? null,
                'delivery_fee' => $job['delivery_fee'] ?? null,
                'created_date' => $job['created_date'] ?? null,
            ];
        }
        return $out;
    }

    public static function setRiderOnline(array $data, ?array $user): array
    {
        $rider = Fns::myRider($user ?? []);
        if (!$rider) Fns::fail(404, 'No rider profile found.');
        if (($rider['status'] ?? null) !== 'approved') {
            Fns::fail(403, 'Your rider account is still under review.');
        }
        return Store::update('RiderProfile', (string) $rider['id'], ['is_online' => !empty($data['online'])]);
    }

    /* -------------------------------------------------------------- support */

    public static function supportQueue(array $data, ?array $user): array
    {
        self::guard($user, 'support.manage');
        return Store::filter('SupportTicket', [], ['sort' => '-created_date', 'limit' => 100]);
    }

    public static function replyTicket(array $data, ?array $user): array
    {
        $ticketId = Fns::str($data['ticket_id'] ?? '');
        if ($ticketId === '') Fns::fail(400, 'Choose a ticket.');
        $body = Fns::str($data['body'] ?? '');
        if (mb_strlen($body) < 2 || mb_strlen($body) > 2000) Fns::fail(400, 'Write a reply between 2 and 2000 characters.');

        $ticket = Store::get('SupportTicket', $ticketId);
        $role = self::roleOf($user);
        $isStaff = in_array($role, ['admin', 'support'], true);
        if (!$isStaff && ($ticket['customer_email'] ?? null) !== Fns::userEmail($user)) {
            Fns::fail(403, 'You cannot reply to this ticket.');
        }

        $messages = is_array($ticket['messages'] ?? null) ? $ticket['messages'] : [];
        $messages[] = [
            'from' => $isStaff ? 'AVORA Support' : (Fns::str($ticket['customer_name'] ?? '') ?: Fns::userEmail($user)),
            'body' => $body,
            'at' => Fns::nowIso(),
        ];
        return Store::update('SupportTicket', $ticketId, [
            'messages' => $messages,
            'status' => $isStaff ? 'answered' : 'open',
            'assigned_to' => $isStaff ? Fns::userEmail($user) : ($ticket['assigned_to'] ?? null),
        ]);
    }

    public static function closeTicket(array $data, ?array $user): array
    {
        self::guard($user, 'support.manage');
        return Store::update('SupportTicket', Fns::str($data['ticket_id'] ?? ''), ['status' => 'closed']);
    }

    public static function supportTicketBoard(array $data, ?array $user): array
    {
        self::guard($user, 'support.manage');
        return [
            'tickets' => Store::filter('SupportTicket', [], ['sort' => '-created_date', 'limit' => 120]),
            'orders' => Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]),
        ];
    }

    public static function setTicketState(array $data, ?array $user): array
    {
        self::guard($user, 'support.manage');
        $ticketId = Fns::str($data['ticket_id'] ?? '');
        if ($ticketId === '') Fns::fail(400, 'Choose a ticket.');
        $ticket = Store::get('SupportTicket', $ticketId);

        $patch = [];
        $note = Fns::str($data['note'] ?? '');
        if (trim($note) !== '') {
            $messages = is_array($ticket['messages'] ?? null) ? $ticket['messages'] : [];
            $messages[] = ['from' => 'AVORA Support', 'body' => trim($note), 'at' => Fns::nowIso()];
            $patch['messages'] = $messages;
        }
        $status = Fns::str($data['status'] ?? '');
        if ($status !== '') $patch['status'] = $status;
        if (array_key_exists('assigned_to', $data)) $patch['assigned_to'] = Fns::str($data['assigned_to'] ?? '');
        if ($status === 'closed' && empty($patch['assigned_to'])) {
            $patch['assigned_to'] = Fns::str($ticket['assigned_to'] ?? '') ?: Fns::userEmail($user);
        }

        $updated = Store::update('SupportTicket', $ticketId, $patch);
        $label = $status !== '' ? $status : 'updated';
        Fns::audit(
            $user ?? [],
            'ticket.' . $label,
            Fns::or($ticket['order_code'] ?? null, $ticket['topic'] ?? null),
            'Ticket ' . $label . ' by ' . Fns::userEmail($user),
            $status === 'closed' ? 'info' : 'warning'
        );
        return $updated;
    }

    public static function supportDashboard(array $data, ?array $user): array
    {
        self::guard($user, 'support.manage');
        $tickets = Store::filter('SupportTicket', [], ['sort' => '-created_date', 'limit' => 200]);
        $refunds = Store::filter('Refund', [], ['sort' => '-created_date', 'limit' => 100]);
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 200]);

        $today = Fns::dayKey(Fns::nowIso());
        $weekAgo = gmdate('Y-m-d', time() - 7 * 86400);
        $open = array_values(array_filter($tickets, fn ($ticket) => ($ticket['status'] ?? null) === 'open'));
        $queue = $open;
        usort($queue, function ($a, $b) {
            $weightA = self::PRIORITY_WEIGHT[$a['priority'] ?? ''] ?? 2;
            $weightB = self::PRIORITY_WEIGHT[$b['priority'] ?? ''] ?? 2;
            if ($weightA !== $weightB) return $weightA <=> $weightB;
            return (Fns::timeMs($a['created_date'] ?? null) ?? 0.0) <=> (Fns::timeMs($b['created_date'] ?? null) ?? 0.0);
        });

        $topics = [];
        foreach ($tickets as $ticket) {
            $key = trim(Fns::str($ticket['topic'] ?? ''));
            if ($key === '') $key = 'Uncategorised';
            if (!isset($topics[$key])) $topics[$key] = ['topic' => $key, 'total' => 0, 'open' => 0];
            $topics[$key]['total']++;
            if (($ticket['status'] ?? null) === 'open') $topics[$key]['open']++;
        }
        $topicRows = array_values($topics);
        usort($topicRows, fn ($a, $b) => ($b['open'] <=> $a['open']) ?: ($b['total'] <=> $a['total']));

        $disputes = array_values(array_filter($refunds, fn ($refund) => ($refund['status'] ?? null) === 'requested'));
        $troubled = array_values(array_filter($orders, fn ($order) => in_array($order['status'] ?? null, ['cancelled', 'failed'], true)));

        $disputeValue = 0.0;
        foreach ($disputes as $refund) $disputeValue += self::num($refund['amount'] ?? null);

        return [
            'stats' => [
                'open' => count($open),
                'unassigned' => count(array_filter($open, fn ($ticket) => empty($ticket['assigned_to']))),
                'urgent' => count(array_filter($open, fn ($ticket) => ($ticket['priority'] ?? null) === 'urgent')),
                'high' => count(array_filter($open, fn ($ticket) => ($ticket['priority'] ?? null) === 'high')),
                'clearedToday' => count(array_filter(
                    $tickets,
                    fn ($ticket) => ($ticket['status'] ?? null) !== 'open' && Fns::dayKey($ticket['updated_date'] ?? null) === $today
                )),
                'disputes' => count($disputes),
                'disputeValue' => $disputeValue,
                'troubledThisWeek' => count(array_filter($troubled, fn ($order) => strcmp(
                    Fns::dayKey($order['created_date'] ?? null),
                    $weekAgo
                ) >= 0)),
                'totalTickets' => count($tickets),
            ],
            'queue' => array_slice($queue, 0, 8),
            'topics' => array_slice($topicRows, 0, 6),
            'disputes' => array_slice($disputes, 0, 6),
            'troubled' => array_slice($troubled, 0, 5),
        ];
    }

    /* ---------------------------------------------------------------- staff */

    public static function adminStaffBoard(array $data, ?array $user): array
    {
        self::requireAdmin($user);
        $staff = Store::filter('StaffMember', [], ['sort' => '-created_date', 'limit' => 100]);
        $users = Store::filter('User', [], ['sort' => '-created_date', 'limit' => 100]);
        $me = Fns::userEmail($user);
        $members = [];
        foreach ($users as $row) {
            if (($row['email'] ?? null) === $me) continue;
            $members[] = [
                'email' => $row['email'] ?? null,
                'full_name' => $row['full_name'] ?? null,
                'role' => $row['role'] ?? null,
            ];
        }
        return ['staff' => $staff, 'members' => $members, 'me' => $me];
    }

    public static function saveStaffMember(array $data, ?array $user): array
    {
        self::requireAdmin($user);
        $email = Fns::userEmail(['email' => $data['email'] ?? '']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) Fns::fail(400, 'Enter a valid email address.');
        $role = Fns::str($data['role'] ?? '');
        if (!in_array($role, ['admin', 'ops', 'finance', 'support'], true)) {
            Fns::fail(400, 'Choose admin, ops, finance or support.');
        }
        $id = Fns::str($data['id'] ?? '');
        $record = [
            'email' => $email,
            'role' => $role,
            'is_active' => array_key_exists('is_active', $data) ? !empty($data['is_active']) : true,
        ];
        if (array_key_exists('full_name', $data)) $record['full_name'] = Fns::str($data['full_name'] ?? '');

        $saved = $id !== ''
            ? Store::update('StaffMember', $id, $record)
            : Store::create('StaffMember', $record);
        Fns::audit(
            $user ?? [],
            $id !== '' ? 'staff.updated' : 'staff.added',
            $email,
            $email . ' set to ' . $role . ($record['is_active'] ? '' : ' (suspended)'),
            'warning'
        );
        return $saved;
    }

    public static function removeStaffMember(array $data, ?array $user): array
    {
        self::requireAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $staff = Store::get('StaffMember', $id);
        Store::delete('StaffMember', $id);
        Fns::audit(
            $user ?? [],
            'staff.removed',
            $staff['email'] ?? null,
            Fns::str($staff['role'] ?? '') . ' access removed',
            'critical'
        );
        return ['ok' => true];
    }

    /* -------------------------------------------------------------- helpers */

    private static function num(mixed $value): float
    {
        return Fns::number($value) ?? 0.0;
    }

    private function __construct() {}
}
