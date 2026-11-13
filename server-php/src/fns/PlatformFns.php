<?php
// Port of src/lib/platform-fns.js: review moderation, account directory, promo
// codes, category directory and the money/payout boards.
declare(strict_types=1);

final class PlatformFns
{
    private const MODERATION_ACTIONS = ['hide', 'unhide', 'clear_flag'];
    private const ACCOUNT_ROLES = ['user', 'admin'];
    private const DISCOUNT_TYPES = ['percent', 'fixed'];

    public static function registry(): array
    {
        return [
            'platform/reviewBoard' => ['auth' => true, 'run' => [self::class, 'reviewBoard']],
            'platform/replyToReview' => ['auth' => true, 'run' => [self::class, 'replyToReview']],
            'platform/flagReview' => ['auth' => true, 'run' => [self::class, 'flagReview']],
            'platform/moderateReview' => ['auth' => true, 'run' => [self::class, 'moderateReview']],
            'platform/accountDirectory' => ['auth' => true, 'run' => [self::class, 'accountDirectory']],
            'platform/setAccountRole' => ['auth' => true, 'run' => [self::class, 'setAccountRole']],
            'platform/promoCodeBoard' => ['auth' => true, 'run' => [self::class, 'promoCodeBoard']],
            'platform/savePromoCode' => ['auth' => true, 'run' => [self::class, 'savePromoCode']],
            'platform/setPromoActive' => ['auth' => true, 'run' => [self::class, 'setPromoActive']],
            'platform/deletePromoCode' => ['auth' => true, 'run' => [self::class, 'deletePromoCode']],
            'platform/previewPromo' => ['auth' => true, 'run' => [self::class, 'previewPromo']],
            'platform/paymentLedger' => ['auth' => true, 'run' => [self::class, 'paymentLedger']],
            'platform/categoryBoard' => ['auth' => true, 'run' => [self::class, 'categoryBoard']],
            'platform/saveCategory' => ['auth' => true, 'run' => [self::class, 'saveCategory']],
            'platform/deleteCategory' => ['auth' => true, 'run' => [self::class, 'deleteCategory']],
            'platform/reorderCategories' => ['auth' => true, 'run' => [self::class, 'reorderCategories']],
            'platform/vendorPayoutBoard' => ['auth' => true, 'run' => [self::class, 'vendorPayoutBoard']],
        ];
    }

    /* ------------------------------------------------------------ reviews */

    public static function reviewBoard(array $data, ?array $user): array
    {
        $email = self::email($user);
        $admin = self::isAdmin($user);

        $reviews = $admin
            ? Store::filter('Review', [], ['sort' => '-created_date', 'limit' => 300])
            : Store::filter('Review', ['owner_email' => $email], ['sort' => '-created_date', 'limit' => 300]);
        $products = $admin
            ? Store::filter('Product', [], ['sort' => '-created_date', 'limit' => 400])
            : Store::filter('Product', ['owner_email' => $email], ['limit' => 400]);

        return ['admin' => $admin, 'reviews' => $reviews, 'products' => $products];
    }

    public static function replyToReview(array $data, ?array $user): array
    {
        $id = Fns::str($data['id'] ?? '');
        $review = Store::get('Review', $id);
        if (!self::isAdmin($user) && ($review['owner_email'] ?? null) !== self::email($user)) {
            Fns::fail(403, 'You can only reply to reviews on your own products.');
        }
        return Store::update('Review', $id, [
            'vendor_reply' => Fns::str($data['reply'] ?? ''),
            'replied_at' => Fns::nowIso(),
        ]);
    }

    public static function flagReview(array $data, ?array $user): array
    {
        $id = Fns::str($data['id'] ?? '');
        $review = Store::get('Review', $id);
        if (!self::isAdmin($user) && ($review['owner_email'] ?? null) !== self::email($user)) {
            Fns::fail(403, 'You can only flag reviews on your own products.');
        }
        $flagged = self::boolValue($data['flagged'] ?? false);
        $reason = $data['reason'] ?? null;
        return Store::update('Review', $id, [
            'is_flagged' => $flagged,
            'flag_reason' => $flagged ? ($reason === null ? 'Flagged for moderation' : Fns::str($reason)) : '',
        ]);
    }

    public static function moderateReview(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $action = Fns::str($data['action'] ?? '');
        if (!in_array($action, self::MODERATION_ACTIONS, true)) {
            Fns::fail(400, 'Choose hide, unhide or clear_flag.');
        }
        $review = Store::get('Review', $id);
        $note = $data['note'] ?? null;
        $patch = $action === 'hide'
            ? ['is_hidden' => true, 'moderation_note' => $note === null ? 'Hidden by administrator' : Fns::str($note)]
            : ($action === 'unhide'
                ? ['is_hidden' => false, 'moderation_note' => $note === null ? 'Restored by administrator' : Fns::str($note)]
                : ['is_flagged' => false, 'flag_reason' => '', 'moderation_note' => $note === null ? 'Flag cleared' : Fns::str($note)]);
        $updated = Store::update('Review', $id, $patch);
        $target = Fns::str($review['product_name'] ?? '')
            ?: (Fns::str($review['store_name'] ?? '') ?: Fns::str($review['id'] ?? $id));
        Fns::audit(
            $user ?? [],
            'review.' . $action,
            $target,
            'Review ' . $action . ' by ' . self::email($user),
            $action === 'unhide' ? 'info' : 'warning'
        );
        return $updated;
    }

    /* ----------------------------------------------------------- accounts */

    public static function accountDirectory(array $data, ?array $user): array
    {
        if (!self::isAdmin($user)) return ['admin' => false, 'accounts' => [], 'totals' => null];

        $users = Store::filter('User', [], ['sort' => '-created_date', 'limit' => 500]);
        $storeRows = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 300]);
        $riderRows = Store::filter('RiderProfile', [], ['sort' => '-created_date', 'limit' => 300]);
        $staffRows = Store::filter('StaffMember', [], ['sort' => '-created_date', 'limit' => 100]);

        $accounts = [];
        foreach ($users as $userRow) {
            $email = $userRow['email'] ?? null;
            $store = null;
            foreach ($storeRows as $row) {
                if (($row['owner_email'] ?? null) === $email) { $store = $row; break; }
            }
            $rider = null;
            foreach ($riderRows as $row) {
                if (($row['user_email'] ?? null) === $email) { $rider = $row; break; }
            }
            $member = null;
            foreach ($staffRows as $row) {
                if (($row['email'] ?? null) === $email) { $member = $row; break; }
            }
            $accounts[] = [
                'id' => $userRow['id'] ?? null,
                'email' => $userRow['email'] ?? null,
                'full_name' => $userRow['full_name'] ?? null,
                'role' => $userRow['role'] ?? null,
                'joined' => $userRow['created_date'] ?? null,
                'store_name' => $store === null ? null : ($store['name'] ?? null),
                'store_approved' => $store === null ? null : self::boolValue($store['is_approved'] ?? false),
                'rider_status' => $rider === null ? null : ($rider['status'] ?? null),
                'staff_role' => $member === null ? null : ($member['role'] ?? null),
            ];
        }

        $admins = 0;
        $vendors = 0;
        $riders = 0;
        $customers = 0;
        foreach ($accounts as $row) {
            if (($row['role'] ?? null) === 'admin') $admins++;
            if (self::truthy($row['store_name'])) $vendors++;
            if (self::truthy($row['rider_status'])) $riders++;
            if (!self::truthy($row['store_name']) && !self::truthy($row['rider_status'])) $customers++;
        }

        return [
            'admin' => true,
            'accounts' => $accounts,
            'me' => self::email($user),
            'totals' => [
                'all' => count($accounts),
                'admins' => $admins,
                'vendors' => $vendors,
                'riders' => $riders,
                'customers' => $customers,
            ],
        ];
    }

    public static function setAccountRole(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $role = Fns::str($data['role'] ?? '');
        if (!in_array($role, self::ACCOUNT_ROLES, true)) {
            Fns::fail(400, 'Role must be user or admin.');
        }
        $updated = Store::update('User', $id, ['role' => $role]);
        Fns::audit($user ?? [], 'account.role', $updated['email'] ?? null, 'Role set to ' . $role, 'warning');
        return ['ok' => true];
    }

    /* -------------------------------------------------------- promo codes */

    public static function promoCodeBoard(array $data, ?array $user): array
    {
        if (!self::isAdmin($user)) return ['admin' => false, 'codes' => []];
        $codes = Store::filter('PromoCode', [], ['sort' => '-created_date', 'limit' => 200]);
        return ['admin' => true, 'codes' => $codes];
    }

    public static function savePromoCode(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $discountType = Fns::str($data['discount_type'] ?? '');
        if (!in_array($discountType, self::DISCOUNT_TYPES, true)) $discountType = 'percent';
        $value = Fns::number($data['value'] ?? null) ?? 0.0;
        $code = strtoupper(trim(Fns::str($data['code'] ?? '')));
        if (mb_strlen($code) < 2 || mb_strlen($code) > 30) {
            Fns::fail(400, 'Enter a code between 2 and 30 characters.');
        }
        if ($value < 0 || $value > 1000000) Fns::fail(400, 'Enter a discount value between 0 and 1000000.');
        $isActive = array_key_exists('is_active', $data) ? self::boolValue($data['is_active']) : true;

        $record = [
            'code' => $code,
            'description' => trim(Fns::str($data['description'] ?? '')),
            'discount_type' => $discountType,
            'value' => $value,
            'min_order' => Fns::number($data['min_order'] ?? null) ?? 0.0,
            'max_discount' => Fns::number($data['max_discount'] ?? null) ?? 0.0,
            'usage_limit' => Fns::number($data['usage_limit'] ?? null) ?? 0.0,
            'expires_at' => Fns::str($data['expires_at'] ?? ''),
            'is_active' => $isActive,
            'store_id' => Fns::str($data['store_id'] ?? ''),
            'created_by' => self::email($user),
        ];

        if ($id === '') {
            $clash = Store::filter('PromoCode', ['code' => $record['code']]);
            if (count($clash) > 0) Fns::fail(409, 'That promo code already exists.');
        }

        $saved = $id !== ''
            ? Store::update('PromoCode', $id, $record)
            : Store::create('PromoCode', array_merge($record, ['used_count' => 0]));

        Fns::audit(
            $user ?? [],
            $id !== '' ? 'promo.updated' : 'promo.created',
            $record['code'],
            $record['code'] . ' ' . ($record['is_active'] ? 'active' : 'paused') . ' · '
                . self::numberText($record['value'])
                . ($record['discount_type'] === 'percent' ? '%' : ' fixed'),
            'info'
        );
        return $saved;
    }

    public static function setPromoActive(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $isActive = self::boolValue($data['is_active'] ?? false);
        $updated = Store::update('PromoCode', $id, ['is_active' => $isActive]);
        $code = Fns::str($updated['code'] ?? '');
        Fns::audit(
            $user ?? [],
            $isActive ? 'promo.activated' : 'promo.paused',
            $code,
            'Promo ' . $code . ' ' . ($isActive ? 'activated' : 'paused'),
            'info'
        );
        return $updated;
    }

    public static function deletePromoCode(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $promo = Store::get('PromoCode', $id);
        Store::delete('PromoCode', $id);
        $code = Fns::str($promo['code'] ?? '');
        Fns::audit($user ?? [], 'promo.deleted', $code, 'Promo ' . $code . ' deleted', 'critical');
        return ['ok' => true];
    }

    public static function previewPromo(array $data, ?array $user): array
    {
        $promo = Fns::findOne('PromoCode', ['code' => strtoupper(trim(Fns::str($data['code'] ?? '')))]);
        $subtotal = Fns::number($data['subtotal'] ?? null) ?? 0.0;
        $storeId = Fns::str($data['store_id'] ?? '');
        $problem = Fns::promoProblem($promo, $subtotal, $storeId === '' ? null : $storeId);
        if ($problem !== null) Fns::fail(400, $problem);

        return [
            'code' => $promo['code'] ?? null,
            'description' => $promo['description'] ?? '',
            'discount' => Fns::promoDiscount($promo, $subtotal),
        ];
    }

    /* ------------------------------------------------------------- money */

    public static function paymentLedger(array $data, ?array $user): array
    {
        $email = self::email($user);
        $orders = Store::filter('Order', ['customer_email' => $email], ['sort' => '-created_date', 'limit' => 100]);
        $payments = Store::filter('Payment', ['customer_email' => $email], ['sort' => '-created_date', 'limit' => 100]);
        $settlements = Store::filter('Settlement', ['subject_email' => $email], ['sort' => '-created_date', 'limit' => 100]);
        $stores = Store::filter('Store', ['owner_email' => $email]);
        $riders = Store::filter('RiderProfile', ['user_email' => $email]);

        return [
            'orders' => $orders,
            'payments' => $payments,
            'settlements' => $settlements,
            'store' => $stores[0] ?? null,
            'rider' => $riders[0] ?? null,
        ];
    }

    /* -------------------------------------------------------- categories */

    public static function categoryBoard(array $data, ?array $user): array
    {
        if (!self::isAdmin($user)) return ['admin' => false, 'categories' => []];
        $categories = Store::filter('Category', [], ['sort' => 'position', 'limit' => 200]);
        return ['admin' => true, 'categories' => $categories];
    }

    public static function saveCategory(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $rawId = $data['id'] ?? null;
        $name = trim(Fns::str($data['name'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 40) {
            Fns::fail(400, 'Enter a category name between 2 and 40 characters.');
        }
        $existing = Store::filter('Category', [], ['sort' => 'position', 'limit' => 200]);

        $needle = self::lower($name);
        foreach ($existing as $row) {
            if (self::lower(Fns::str($row['name'] ?? '')) === $needle && ($row['id'] ?? null) !== $rawId) {
                Fns::fail(409, 'That category already exists.');
            }
        }

        $emoji = trim(Fns::str($data['emoji'] ?? ''));
        $record = [
            'name' => $name,
            'emoji' => $emoji === '' ? '🍽️' : $emoji,
            'description' => trim(Fns::str($data['description'] ?? '')),
            'is_active' => array_key_exists('is_active', $data) ? self::boolValue($data['is_active']) : true,
        ];

        $saved = $id !== ''
            ? Store::update('Category', $id, $record)
            : Store::create('Category', array_merge($record, [
                'tint' => 'bg-[#F6EEFB]',
                'position' => count($existing),
            ]));

        Fns::audit(
            $user ?? [],
            $id !== '' ? 'category.updated' : 'category.created',
            $name,
            'Category ' . $name . ' ' . ($record['is_active'] ? 'visible' : 'hidden'),
            'info'
        );
        return $saved;
    }

    public static function deleteCategory(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $id = Fns::str($data['id'] ?? '');
        $category = Store::get('Category', $id);
        Store::delete('Category', $id);
        $name = Fns::str($category['name'] ?? '');
        Fns::audit($user ?? [], 'category.deleted', $name, 'Category ' . $name . ' deleted', 'critical');
        return ['ok' => true];
    }

    public static function reorderCategories(array $data, ?array $user): array
    {
        self::assertAdmin($user);
        $ids = is_array($data['ids'] ?? null) ? array_values($data['ids']) : [];
        if (count($ids) < 1 || count($ids) > 100) {
            Fns::fail(400, 'Send between 1 and 100 category ids.');
        }
        $items = [];
        foreach ($ids as $index => $id) {
            $items[] = ['id' => Fns::str($id), 'position' => $index];
        }
        Store::bulkUpdate('Category', $items);
        Fns::audit($user ?? [], 'category.reordered', 'Store directory', 'Directory category order changed', 'info');
        return ['ok' => true];
    }

    public static function vendorPayoutBoard(array $data, ?array $user): array
    {
        $email = self::email($user);
        $store = Fns::findOne('Store', ['owner_email' => $email]);
        $settlements = Store::filter('Settlement', ['subject_email' => $email], ['sort' => '-created_date', 'limit' => 60]);
        $orders = $store
            ? Store::filter('Order', ['store_id' => $store['id']], ['sort' => '-created_date', 'limit' => 200])
            : [];

        return ['store' => $store, 'settlements' => $settlements, 'orders' => $orders];
    }

    /* ------------------------------------------------------------ helpers */

    private static function email(?array $user): string
    {
        return Fns::str($user['email'] ?? '');
    }

    private static function isAdmin(?array $user): bool
    {
        if (($user['role'] ?? null) === 'admin') return true;
        $staff = Store::filter('StaffMember', ['email' => self::email($user), 'is_active' => true]);
        return ($staff[0]['role'] ?? null) === 'admin';
    }

    private static function assertAdmin(?array $user): void
    {
        if (!self::isAdmin($user)) Fns::fail(403, 'Only administrators can do that.');
    }

    /** JS truthiness for the values the store holds (undefined/null/''/0 are falsy). */
    private static function truthy(mixed $value): bool
    {
        if (is_bool($value)) return $value;
        if ($value === null) return false;
        if (is_string($value)) return $value !== '';
        if (is_int($value) || is_float($value)) return $value != 0;
        if (is_array($value)) return count($value) > 0;
        return true;
    }

    /** The `z.boolean()` fields: only real booleans, 1/0 and "true"/"false" flip from the default. */
    private static function boolValue(mixed $value, bool $default = false): bool
    {
        if (is_bool($value)) return $value;
        if (is_int($value) || is_float($value)) return $value != 0;
        if (is_string($value)) {
            $text = strtolower(trim($value));
            if ($text === 'true' || $text === '1') return true;
            if ($text === 'false' || $text === '0' || $text === '') return false;
        }
        if (is_array($value)) return count($value) > 0;
        return $default;
    }

    /** `${number}` in a template literal: 10 stays "10", 10.5 stays "10.5". */
    private static function numberText(mixed $value): string
    {
        $number = Fns::number($value) ?? 0.0;
        if (floor($number) == $number) return (string) (int) $number;
        return rtrim(rtrim((string) $number, '0'), '.');
    }

    /** JS `String.prototype.toLowerCase()` for the ASCII names the directory holds. */
    private static function lower(string $value): string
    {
        return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    }

    private function __construct() {}
}
