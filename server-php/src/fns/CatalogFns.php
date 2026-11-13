<?php
// Port of src/lib/catalog-fns.js: storefront reads.
declare(strict_types=1);

final class CatalogFns
{
    private const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'rider_assigned', 'picked_up'];

    public static function registry(): array
    {
        return [
            'catalog/homeFeed' => ['auth' => false, 'run' => [self::class, 'homeFeed']],
            'catalog/browseStores' => ['auth' => true, 'run' => [self::class, 'browseStores']],
            'catalog/storeMenu' => ['auth' => true, 'run' => [self::class, 'storeMenu']],
            'catalog/offersBoard' => ['auth' => true, 'run' => [self::class, 'offersBoard']],
            'catalog/customerHome' => ['auth' => true, 'run' => [self::class, 'customerHome']],
        ];
    }

    public static function homeFeed(array $data, ?array $user): array
    {
        $stores = Store::filter('Store', ['is_approved' => true, 'is_open' => true], ['sort' => '-rating', 'limit' => 60]);
        $categories = Store::filter('Category', ['is_active' => true], ['sort' => 'position', 'limit' => 12]);
        $products = Store::filter('Product', ['is_available' => true], ['sort' => '-created_date', 'limit' => 12]);
        $storeCount = Store::count('Store', ['is_approved' => true]);

        return [
            'storeCount' => $storeCount,
            'categories' => array_map(fn ($category) => [
                'label' => $category['name'] ?? '',
                'emoji' => $category['emoji'] ?? '🍽️',
                'tint' => $category['tint'] ?? 'bg-[#F6EEFB]',
            ], $categories),
            'stores' => array_map(fn ($store) => [
                'id' => $store['id'],
                'name' => $store['name'] ?? '',
                'category' => $store['category'] ?? '',
                'cuisine' => $store['tagline'] ?? ($store['category'] ?? ''),
                'rating' => $store['rating'] ?? '—',
                'eta' => ($store['eta_min'] ?? 20) . '–' . ($store['eta_max'] ?? 35) . ' min',
                'fee' => !empty($store['delivery_fee']) ? Fns::ngn($store['delivery_fee']) . ' delivery' : 'Free delivery',
                'promo' => $store['promo'] ?? '',
                'cover' => ($store['cover_url'] ?? '') ?: ($store['photos'][0] ?? ''),
            ], $stores),
            'essentials' => array_map(fn ($product) => [
                'id' => $product['id'],
                'name' => $product['name'] ?? '',
                'unit' => ($product['unit'] ?? '') ?: ($product['category'] ?? ''),
                'price' => Fns::ngn($product['price'] ?? 0),
                'emoji' => $product['emoji'] ?? '🛍️',
                'tint' => $product['tint'] ?? 'bg-[#F6EEFB]',
                'image_url' => $product['image_url'] ?? '',
            ], $products),
        ];
    }

    public static function browseStores(array $data, ?array $user): array
    {
        $stores = Store::filter('Store', [], ['sort' => '-created_date', 'limit' => 200]);
        $categories = Store::filter('Category', ['is_active' => true], ['sort' => 'position', 'limit' => 40]);
        $needle = strtolower(trim(Fns::str($data['q'] ?? '')));
        $category = $data['category'] ?? null;

        $list = array_values(array_filter($stores, fn ($store) => ($store['is_approved'] ?? null) !== false));
        if ($category && $category !== 'All') {
            $list = array_values(array_filter($list, fn ($store) => ($store['category'] ?? null) === $category));
        }
        if ($needle !== '') {
            $list = array_values(array_filter(
                $list,
                fn ($store) => Fns::matchesAny($store, $needle, ['name', 'tagline', 'category', 'area'])
            ));
        }

        return ['stores' => $list, 'categories' => $categories];
    }

    public static function storeMenu(array $data, ?array $user): array
    {
        $store = null;
        try {
            $store = Store::get('Store', Fns::str($data['store_id'] ?? ''));
        } catch (Throwable) {
            $store = null;
        }
        if (!$store) {
            return ['store' => null, 'products' => [], 'reviews' => 0, 'rating' => 0];
        }

        $products = Store::filter('Product', ['store_id' => $store['id'], 'is_available' => true], ['sort' => 'name', 'limit' => 200]);
        $reviews = Store::filter('Review', ['store_id' => $store['id']], ['limit' => 100]);
        $needle = strtolower(trim(Fns::str($data['q'] ?? '')));

        $list = $needle === ''
            ? $products
            : array_values(array_filter($products, fn ($product) => Fns::matchesAny($product, $needle, ['name', 'category'])));

        $ratings = array_values(array_filter($reviews, fn ($review) => empty($review['is_hidden'])));
        $rating = count($ratings)
            ? round(array_sum(array_map(fn ($review) => $review['rating'] ?? 0, $ratings)) / count($ratings), 1)
            : ($store['rating'] ?? 4.5);

        return ['store' => $store, 'products' => $list, 'reviews' => count($ratings), 'rating' => $rating];
    }

    public static function offersBoard(array $data, ?array $user): array
    {
        $promos = Store::filter('PromoCode', ['is_active' => true], ['sort' => '-created_date', 'limit' => 40]);
        $stores = Store::filter('Store', [], ['sort' => '-rating', 'limit' => 60]);
        $now = microtime(true) * 1000;

        $live = array_values(array_filter($promos, function ($promo) use ($now) {
            $expires = Fns::timeMs($promo['expires_at'] ?? null);
            $expired = $expires !== null && $expires <= $now;
            $usedUp = !empty($promo['usage_limit']) && (int) ($promo['used_count'] ?? 0) >= (int) $promo['usage_limit'];
            return !$expired && !$usedUp;
        }));
        $open = array_values(array_filter(
            $stores,
            fn ($store) => ($store['is_approved'] ?? null) !== false && ($store['is_open'] ?? null) !== false
        ));

        return ['promos' => $live, 'stores' => $open];
    }

    public static function customerHome(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        $stores = Store::filter('Store', [], ['sort' => '-rating', 'limit' => 60]);
        $products = Store::filter('Product', ['is_available' => true], ['sort' => '-created_date', 'limit' => 60]);
        $categories = Store::filter('Category', ['is_active' => true], ['sort' => 'position', 'limit' => 20]);
        $orders = Store::filter('Order', ['customer_email' => $email], ['sort' => '-created_date', 'limit' => 10]);
        $favorites = Store::filter('Favorite', ['user_email' => $email], ['limit' => 20]);
        $promos = Store::filter('PromoCode', ['is_active' => true], ['sort' => '-created_date', 'limit' => 10]);
        $unread = Store::filter('Notification', ['user_email' => $email, 'is_read' => false], ['limit' => 50]);

        $approved = array_values(array_filter($stores, fn ($store) => ($store['is_approved'] ?? null) !== false));
        $open = array_values(array_filter($approved, fn ($store) => ($store['is_open'] ?? null) !== false));
        $now = microtime(true) * 1000;
        $activeOrder = null;
        foreach ($orders as $order) {
            if (in_array($order['status'] ?? null, self::ACTIVE_STATUSES, true)) {
                $activeOrder = $order;
                break;
            }
        }

        return [
            'stores' => array_slice($approved, 0, 8),
            'openStores' => count($open),
            'categories' => $categories,
            'products' => $products,
            'activeOrder' => $activeOrder,
            'recentOrders' => array_slice($orders, 0, 4),
            'favorites' => $favorites,
            'promos' => array_values(array_filter(
                $promos,
                fn ($promo) => Fns::timeMs($promo['expires_at'] ?? null) === null || Fns::timeMs($promo['expires_at']) > $now
            )),
            'unread' => count($unread),
        ];
    }

    private function __construct() {}
}
