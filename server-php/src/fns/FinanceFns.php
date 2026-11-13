<?php
// Port of src/lib/finance-fns.js: the vendor fee register (one-off joining fee
// plus the monthly subscription), the admin fee board and the vendor
// statement. Shared helpers (loadFees, periodOf, monthEnd, shortId, staffRole,
// audit) live in src/Fn.php as Fns.
declare(strict_types=1);

final class FinanceFns
{
    public static function registry(): array
    {
        return [
            'finance/vendorFeeBoard' => ['auth' => true, 'run' => [self::class, 'vendorFeeBoard']],
            'finance/runVendorBilling' => ['auth' => true, 'run' => [self::class, 'runVendorBilling']],
            'finance/recordVendorChargePaid' => ['auth' => true, 'run' => [self::class, 'recordVendorChargePaid']],
            'finance/recordStoreJoinFee' => ['auth' => true, 'run' => [self::class, 'recordStoreJoinFee']],
            'finance/waiveVendorCharge' => ['auth' => true, 'run' => [self::class, 'waiveVendorCharge']],
            'finance/vendorFeeSummary' => ['auth' => true, 'run' => [self::class, 'vendorFeeSummary']],
        ];
    }

    /* ------------------------------------------------------------- settings */

    /** allowMoney() in the JS module: admin or the finance staff role. */
    private static function allowMoney(array $user): void
    {
        Fns::assertStaffRole($user, ['admin', 'finance'], 'You do not have permission to manage vendor fees.');
    }

    /* ------------------------------------------------------- charge register */

    /**
     * Idempotent billing sweep: raises the one-off joining fee for a vendor
     * without one yet, and the monthly subscription for every live vendor that
     * has not been billed for the current month.
     *
     * @return array<int,array> Charges created by this sweep.
     */
    public static function ensureVendorCharges(): array
    {
        $fees = Fns::loadFees();
        $period = Fns::periodOf();
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200]);
        $charges = Store::filter('VendorCharge', [], ['sort' => '-created_date', 'limit' => 500]);
        $created = [];

        foreach ($stores as $store) {
            if (!self::truthy($store['owner_email'] ?? null)) continue;
            if (($store['review_note'] ?? null) === 'Rejected') continue;
            $mine = self::where($charges, fn ($charge) => ($charge['store_id'] ?? null) === ($store['id'] ?? null));

            if (!self::some($mine, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee')) {
                $created[] = self::joinCharge($store, $fees);
            }

            $joinPaid = self::truthy($store['join_fee_paid'] ?? null)
                || self::some($mine, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee' && ($charge['status'] ?? null) === 'paid');
            $billedThisMonth = self::some(
                $mine,
                fn ($charge) => ($charge['kind'] ?? null) === 'subscription' && ($charge['period'] ?? null) === $period
            );
            if (self::truthy($store['is_approved'] ?? null) && $joinPaid && !$billedThisMonth) {
                $created[] = self::monthCharge($store, $fees, $period);
            }
        }
        return $created;
    }

    private static function joinCharge(array $store, array $fees): array
    {
        // `undefined` fields vanish from JSON in the Node store; drop the nulls
        // so created rows keep the same shape.
        $row = array_filter([
            'store_id' => $store['id'] ?? null,
            'store_name' => $store['name'] ?? null,
            'owner_email' => $store['owner_email'] ?? null,
        ], fn ($value) => $value !== null);
        $row['kind'] = 'join_fee';
        $row['amount'] = $fees['joinFee'];
        $row['status'] = 'due';
        $row['due_date'] = gmdate('Y-m-d', time() + 14 * 86400);
        $row['reference'] = 'JOIN-' . Fns::shortId($store['id'] ?? '', 5);
        $row['note'] = 'One-off vendor registration fee';
        return Store::create('VendorCharge', $row);
    }

    private static function monthCharge(array $store, array $fees, string $period): array
    {
        $row = array_filter([
            'store_id' => $store['id'] ?? null,
            'store_name' => $store['name'] ?? null,
            'owner_email' => $store['owner_email'] ?? null,
        ], fn ($value) => $value !== null);
        $row['kind'] = 'subscription';
        $row['period'] = $period;
        $row['amount'] = $fees['monthlyFee'];
        $row['status'] = 'due';
        $row['due_date'] = Fns::monthEnd($period);
        $row['reference'] = 'SUB-' . $period . '-' . Fns::shortId($store['id'] ?? '', 4);
        $row['note'] = $period . ' platform subscription';
        return Store::create('VendorCharge', $row);
    }

    private static function markChargePaid(array $charge, array $user): array
    {
        if (($charge['status'] ?? null) === 'paid') return $charge;
        $paid = Store::update('VendorCharge', Fns::str($charge['id'] ?? ''), [
            'status' => 'paid',
            'paid_at' => Fns::nowIso(),
        ]);

        if (($charge['kind'] ?? null) === 'join_fee' && self::truthy($charge['store_id'] ?? null)) {
            Store::update('Store', Fns::str($charge['store_id']), [
                'join_fee_paid' => true,
                'join_fee_paid_at' => $paid['paid_at'] ?? null,
                'subscription_status' => 'active',
            ]);
        }

        $label = ($charge['kind'] ?? null) === 'join_fee'
            ? 'Joining fee'
            : Fns::str($charge['period'] ?? null) . ' subscription';
        Fns::audit(
            $user,
            'vendor.' . Fns::str($charge['kind'] ?? null) . '.paid',
            Fns::or($charge['store_name'] ?? null, $charge['store_id'] ?? null),
            $label . ' of ₦' . Fns::str($charge['amount'] ?? null) . ' recorded as paid'
        );
        return $paid;
    }

    /* ---------------------------------------------------------- admin board */

    public static function vendorFeeBoard(array $data, ?array $user): array
    {
        self::allowMoney($user ?? []);
        $fees = Fns::loadFees();
        $generated = self::ensureVendorCharges();
        $period = Fns::periodOf();
        $list = Store::filter('VendorCharge', [], ['sort' => '-created_date', 'limit' => 200]);
        $storeList = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200]);

        $due = self::where($list, fn ($charge) => ($charge['status'] ?? null) === 'due');
        $paidJoin = self::where($list, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee' && ($charge['status'] ?? null) === 'paid');
        $paidSub = self::where($list, fn ($charge) => ($charge['kind'] ?? null) === 'subscription' && ($charge['status'] ?? null) === 'paid');
        $billable = self::where(
            $storeList,
            fn ($store) => self::truthy($store['is_approved'] ?? null) && self::truthy($store['join_fee_paid'] ?? null)
        );

        return [
            'fees' => $fees,
            'period' => $period,
            'charges' => array_slice($list, 0, 40),
            'generated' => count($generated),
            'totals' => [
                'joinCollected' => self::sum($paidJoin),
                'subCollected' => self::sum($paidSub),
                'outstanding' => self::sum($due),
                'pendingJoin' => self::sum(self::where($due, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee')),
                'pendingSub' => self::sum(self::where($due, fn ($charge) => ($charge['kind'] ?? null) === 'subscription')),
                'mrr' => self::integral(count($billable) * (Fns::number($fees['monthlyFee'] ?? null) ?? 0.0)),
                'vendors' => count(self::where($storeList, fn ($store) => self::truthy($store['is_approved'] ?? null))),
                'awaitingFee' => count(self::where($storeList, fn ($store) => !self::truthy($store['join_fee_paid'] ?? null))),
            ],
        ];
    }

    public static function runVendorBilling(array $data, ?array $user): array
    {
        self::allowMoney($user ?? []);
        $created = self::ensureVendorCharges();
        $period = Fns::periodOf();
        Fns::audit($user ?? [], 'vendor.billing.run', $period, count($created) . ' vendor charges raised for ' . $period);
        return ['period' => $period, 'created' => count($created)];
    }

    public static function recordVendorChargePaid(array $data, ?array $user): array
    {
        self::allowMoney($user ?? []);
        $chargeId = Fns::str($data['charge_id'] ?? '');
        if ($chargeId === '') Fns::fail(400, 'A charge is required.');
        return self::markChargePaid(Store::get('VendorCharge', $chargeId), $user ?? []);
    }

    /** Used by ops while vetting a store: the joining fee is part of onboarding. */
    public static function recordStoreJoinFee(array $data, ?array $user): array
    {
        Fns::assertStaffRole($user ?? [], ['admin', 'finance', 'ops'], 'You do not have permission to record vendor fees.');
        $storeId = Fns::str($data['store_id'] ?? '');
        if ($storeId === '') Fns::fail(400, 'A store is required.');
        $store = Store::get('Store', $storeId);
        $fees = Fns::loadFees();
        $existing = Store::filter('VendorCharge', ['store_id' => $store['id'], 'kind' => 'join_fee'])[0] ?? null;
        $charge = $existing ?? self::joinCharge($store, $fees);
        return self::markChargePaid($charge, $user ?? []);
    }

    public static function waiveVendorCharge(array $data, ?array $user): array
    {
        self::allowMoney($user ?? []);
        $chargeId = Fns::str($data['charge_id'] ?? '');
        if ($chargeId === '') Fns::fail(400, 'A charge is required.');
        $reason = $data['reason'] ?? null;
        $reason = $reason === null ? '' : Fns::str($reason);
        if (mb_strlen($reason) > 300) Fns::fail(400, 'Keep the reason under 300 characters.');

        $charge = Store::get('VendorCharge', $chargeId);
        $patch = ['status' => 'waived'];
        $note = trim($reason);
        // Trimmed reason wins; otherwise the charge keeps the note it already has.
        if ($note !== '') $patch['note'] = $note;
        elseif (array_key_exists('note', $charge)) $patch['note'] = $charge['note'];
        $waived = Store::update('VendorCharge', $chargeId, $patch);

        if (($charge['kind'] ?? null) === 'join_fee' && self::truthy($charge['store_id'] ?? null)) {
            Store::update('Store', Fns::str($charge['store_id']), [
                'join_fee_paid' => true,
                'join_fee_paid_at' => Fns::nowIso(),
            ]);
        }

        Fns::audit(
            $user ?? [],
            'vendor.' . Fns::str($charge['kind'] ?? null) . '.waived',
            Fns::or($charge['store_name'] ?? null, $charge['store_id'] ?? null),
            (($charge['kind'] ?? null) === 'join_fee' ? 'Joining fee' : 'Subscription')
                . ' of ₦' . Fns::str($charge['amount'] ?? null)
                . ' waived — ' . ($reason !== '' ? $reason : 'no reason given'),
            'warning'
        );
        return $waived;
    }

    /* ------------------------------------------------------ vendor statement */

    public static function vendorFeeSummary(array $data, ?array $user): array
    {
        $fees = Fns::loadFees();
        $store = Store::filter('Store', ['owner_email' => Fns::userEmail($user ?? [])])[0] ?? null;
        if (!$store) return ['fees' => $fees, 'store' => null, 'charges' => [], 'due' => 0, 'joinPaid' => false];

        $options = ['sort' => '-created_date', 'limit' => 40];
        $charges = Store::filter('VendorCharge', ['store_id' => $store['id']], $options);
        if (!self::some($charges, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee')) {
            self::joinCharge($store, $fees);
            $charges = Store::filter('VendorCharge', ['store_id' => $store['id']], $options);
        }

        return [
            'fees' => $fees,
            'store' => $store,
            'charges' => $charges,
            'due' => self::sum(self::where($charges, fn ($charge) => ($charge['status'] ?? null) === 'due')),
            'joinPaid' => self::truthy($store['join_fee_paid'] ?? null)
                || self::some($charges, fn ($charge) => ($charge['kind'] ?? null) === 'join_fee' && ($charge['status'] ?? null) === 'paid'),
        ];
    }

    /* --------------------------------------------------------------- helpers */

    /** JS truthiness for values read back from the JSON store. */
    private static function truthy(mixed $value): bool
    {
        if (is_array($value)) return true; // arrays and objects are always truthy
        if (is_string($value)) return $value !== ''; // "0" is truthy in JS
        return (bool) $value;
    }

    /** @return array<int,array> Rows matching the predicate, re-indexed. */
    private static function where(array $rows, callable $predicate): array
    {
        return array_values(array_filter($rows, $predicate));
    }

    private static function some(array $rows, callable $predicate): bool
    {
        foreach ($rows as $row) {
            if ($predicate($row)) return true;
        }
        return false;
    }

    /** `items.reduce((total, item) => total + (item.amount || 0), 0)` */
    private static function sum(array $items): int|float|string
    {
        $total = 0;
        foreach ($items as $item) {
            $total = self::plus($total, Fns::or($item['amount'] ?? null, 0));
        }
        return $total;
    }

    /** JS `+`: a string operand concatenates, numbers stay numbers. */
    private static function plus(mixed $left, mixed $right): int|float|string
    {
        if (is_string($left) || is_string($right)) return Fns::str($left) . Fns::str($right);
        return self::integral((Fns::number($left) ?? 0.0) + (Fns::number($right) ?? 0.0));
    }

    /** JS numbers serialise without a decimal part; keep PHP sums integral too. */
    private static function integral(float $value): int|float
    {
        return fmod($value, 1.0) === 0.0 && abs($value) <= 9_007_199_254_740_991 ? (int) $value : $value;
    }

    private function __construct() {}
}
