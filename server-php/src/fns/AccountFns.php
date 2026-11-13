<?php
// Port of src/lib/account-fns.js: address book, payment methods, favourites,
// reviews and support tickets. Personal tables are narrowed to the signed-in
// account, mirroring db.as(email) in the Node backend.
declare(strict_types=1);

final class AccountFns
{
    private const PERSONAL = ['Address', 'PaymentMethod', 'Favorite'];

    public static function registry(): array
    {
        return [
            'account/accountBoard' => ['auth' => true, 'run' => [self::class, 'accountBoard']],
            'account/saveAddress' => ['auth' => true, 'run' => [self::class, 'saveAddress']],
            'account/deleteAddress' => ['auth' => true, 'run' => [self::class, 'deleteAddress']],
            'account/setDefaultAddress' => ['auth' => true, 'run' => [self::class, 'setDefaultAddress']],
            'account/savePaymentMethod' => ['auth' => true, 'run' => [self::class, 'savePaymentMethod']],
            'account/deletePaymentMethod' => ['auth' => true, 'run' => [self::class, 'deletePaymentMethod']],
            'account/setDefaultPaymentMethod' => ['auth' => true, 'run' => [self::class, 'setDefaultPaymentMethod']],
            'account/addFavorite' => ['auth' => true, 'run' => [self::class, 'addFavorite']],
            'account/removeFavorite' => ['auth' => true, 'run' => [self::class, 'removeFavorite']],
            'account/submitReview' => ['auth' => true, 'run' => [self::class, 'submitReview']],
            'account/openSupportTicket' => ['auth' => true, 'run' => [self::class, 'openSupportTicket']],
        ];
    }

    // --- address book ----------------------------------------------------

    public static function accountBoard(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $addresses = self::mine('Address', $email, [], ['sort' => '-created_date', 'limit' => 40]);
        $cards = self::mine('PaymentMethod', $email, [], ['sort' => '-created_date', 'limit' => 20]);
        $favorites = self::mine('Favorite', $email, [], ['sort' => '-created_date', 'limit' => 60]);

        return [
            'addresses' => self::defaultFirst($addresses),
            'cards' => self::defaultFirst($cards),
            'favorites' => $favorites,
        ];
    }

    public static function saveAddress(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $label = self::requireText($data, 'label', 1, 40);
        $line1 = self::requireText($data, 'line1', 3, 200);
        $payload = [];
        foreach (['area', 'city', 'phone', 'notes'] as $field) {
            if (array_key_exists($field, $data)) $payload[$field] = Fns::str($data[$field]);
        }
        $payload['label'] = $label;
        $payload['line1'] = $line1;
        if (array_key_exists('is_default', $data)) $payload['is_default'] = (bool) $data['is_default'];

        $id = Fns::str($data['id'] ?? '');
        $saved = $id !== ''
            ? self::updateOwned('Address', $id, $email, $payload)
            : Store::create('Address', array_merge(['city' => 'Lagos'], $payload, ['user_email' => $email]));

        if (!empty($payload['is_default'])) {
            foreach (self::mine('Address', $email, [], ['sort' => '-created_date', 'limit' => 40]) as $address) {
                if (($address['id'] ?? null) !== $saved['id'] && !empty($address['is_default'])) {
                    Store::update('Address', (string) $address['id'], ['is_default' => false]);
                }
            }
        }
        return $saved;
    }

    public static function deleteAddress(array $data, array $user): array
    {
        self::deleteOwned('Address', Fns::str($data['id'] ?? ''), Fns::userEmail($user));
        return ['ok' => true];
    }

    public static function setDefaultAddress(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $id = Fns::str($data['id'] ?? '');
        foreach (self::mine('Address', $email, [], ['sort' => '-created_date', 'limit' => 40]) as $address) {
            Store::update('Address', (string) $address['id'], ['is_default' => ($address['id'] ?? null) === $id]);
        }
        return ['ok' => true];
    }

    // --- payment methods -------------------------------------------------

    public static function savePaymentMethod(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $label = self::requireText($data, 'label', 1, 40);
        $brand = Fns::str($data['brand'] ?? '');
        if (!in_array($brand, ['visa', 'mastercard', 'verve', 'amex', 'other'], true)) {
            Fns::fail(400, 'Pick a card brand.');
        }
        $last4 = Fns::str($data['last4'] ?? '');
        if (!preg_match('/^\d{4}$/', $last4)) Fns::fail(400, 'Enter the last four digits.');

        $payload = [
            'label' => $label,
            'brand' => $brand,
            'last4' => $last4,
            'exp_month' => (int) round(Fns::number($data['exp_month'] ?? 0) ?? 0),
            'exp_year' => (int) round(Fns::number($data['exp_year'] ?? 0) ?? 0),
            'holder' => Fns::str($data['holder'] ?? ''),
        ];
        if (array_key_exists('is_default', $data)) $payload['is_default'] = (bool) $data['is_default'];

        $id = Fns::str($data['id'] ?? '');
        $saved = $id !== ''
            ? self::updateOwned('PaymentMethod', $id, $email, $payload)
            : Store::create('PaymentMethod', array_merge($payload, ['user_email' => $email]));

        if (!empty($payload['is_default'])) {
            foreach (self::mine('PaymentMethod', $email, [], ['sort' => '-created_date', 'limit' => 20]) as $card) {
                if (($card['id'] ?? null) !== $saved['id'] && !empty($card['is_default'])) {
                    Store::update('PaymentMethod', (string) $card['id'], ['is_default' => false]);
                }
            }
        }
        return $saved;
    }

    public static function deletePaymentMethod(array $data, array $user): array
    {
        self::deleteOwned('PaymentMethod', Fns::str($data['id'] ?? ''), Fns::userEmail($user));
        return ['ok' => true];
    }

    public static function setDefaultPaymentMethod(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $id = Fns::str($data['id'] ?? '');
        foreach (self::mine('PaymentMethod', $email, [], ['sort' => '-created_date', 'limit' => 20]) as $card) {
            Store::update('PaymentMethod', (string) $card['id'], ['is_default' => ($card['id'] ?? null) === $id]);
        }
        return ['ok' => true];
    }

    // --- favourites ------------------------------------------------------

    public static function addFavorite(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $productId = Fns::str($data['product_id'] ?? '');
        if ($productId === '') Fns::fail(400, 'An item is required.');
        $existing = self::mine('Favorite', $email, ['product_id' => $productId], ['limit' => 1]);
        if ($existing) return $existing[0];

        $payload = ['product_id' => $productId, 'name' => Fns::str($data['name'] ?? '')];
        foreach (['price', 'emoji', 'tint', 'unit', 'store_id', 'store_name'] as $field) {
            if (array_key_exists($field, $data)) $payload[$field] = $data[$field];
        }
        return Store::create('Favorite', array_merge($payload, ['user_email' => $email]));
    }

    public static function removeFavorite(array $data, array $user): array
    {
        $email = Fns::userEmail($user);
        $productId = Fns::str($data['product_id'] ?? '');
        foreach (self::mine('Favorite', $email, ['product_id' => $productId], ['limit' => 20]) as $favorite) {
            Store::delete('Favorite', (string) $favorite['id']);
        }
        return ['ok' => true];
    }

    // --- reviews & tickets -----------------------------------------------

    public static function submitReview(array $data, array $user): array
    {
        $store = null;
        try {
            $store = Store::get('Store', Fns::str($data['store_id'] ?? ''));
        } catch (Throwable) {
            $store = null;
        }
        if (!$store) Fns::fail(404, 'That store no longer exists.');

        $product = null;
        $productId = Fns::str($data['product_id'] ?? '');
        if ($productId !== '') {
            try {
                $product = Store::get('Product', $productId);
            } catch (Throwable) {
                $product = null;
            }
        }
        $rating = (int) round(Fns::number($data['rating'] ?? 0) ?? 0);
        if ($rating < 1 || $rating > 5) Fns::fail(400, 'Pick a rating from 1 to 5.');

        return Store::create('Review', [
            'store_id' => $store['id'],
            'store_name' => $store['name'] ?? '',
            'owner_email' => $store['owner_email'] ?? '',
            'product_id' => $product['id'] ?? '',
            'product_name' => $product['name'] ?? '',
            'customer_email' => Fns::userEmail($user),
            'customer_name' => Fns::displayName($user),
            'order_code' => Fns::str($data['order_code'] ?? ''),
            'rating' => $rating,
            'comment' => Fns::str($data['comment'] ?? ''),
        ]);
    }

    public static function openSupportTicket(array $data, array $user): array
    {
        $topic = self::requireText($data, 'topic', 3, 80);
        $message = self::requireText($data, 'message', 5, 1500);
        $priority = Fns::str($data['priority'] ?? '');
        if ($priority === '') $priority = 'normal';

        return Store::create('SupportTicket', [
            'order_code' => Fns::str($data['order_code'] ?? ''),
            'customer_email' => Fns::userEmail($user),
            'customer_name' => Fns::displayName($user),
            'topic' => $topic,
            'message' => $message,
            'priority' => $priority,
            'status' => 'open',
            'messages' => [[
                'from' => Fns::userEmail($user),
                'body' => $message,
                'at' => Fns::nowIso(),
            ]],
        ]);
    }

    // --- scoping helpers -------------------------------------------------

    private static function mine(string $entity, string $email, array $query = [], array $options = []): array
    {
        return Store::filter($entity, array_merge($query, ['user_email' => $email]), $options);
    }

    private static function updateOwned(string $entity, string $id, string $email, array $payload): array
    {
        $rows = self::mine($entity, $email, ['id' => $id]);
        if (!$rows) Fns::fail(404, 'Not found');
        return Store::update($entity, $id, $payload);
    }

    private static function deleteOwned(string $entity, string $id, string $email): void
    {
        $rows = self::mine($entity, $email, ['id' => $id]);
        if (!$rows) Fns::fail(404, 'Not found');
        Store::delete($entity, $id);
    }

    private static function defaultFirst(array $rows): array
    {
        usort($rows, fn ($a, $b) => (int) ($b['is_default'] ?? 0) <=> (int) ($a['is_default'] ?? 0));
        return $rows;
    }

    private static function requireText(array $data, string $field, int $min, int $max): string
    {
        $value = trim(Fns::str($data[$field] ?? ''));
        if (mb_strlen($value) < $min) Fns::fail(400, 'Please fill in the required fields.');
        return mb_substr($value, 0, $max);
    }

    private function __construct() {}
}
