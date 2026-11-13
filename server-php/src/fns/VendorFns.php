<?php
// Port of src/lib/vendor-fns.js: the vendor console's catalogue and storefront.
declare(strict_types=1);

final class VendorFns
{
    public static function registry(): array
    {
        return [
            'vendor/vendorCatalogue' => ['auth' => true, 'run' => [self::class, 'vendorCatalogue']],
            'vendor/createVendorProduct' => ['auth' => true, 'run' => [self::class, 'createVendorProduct']],
            'vendor/updateVendorProduct' => ['auth' => true, 'run' => [self::class, 'updateVendorProduct']],
            'vendor/deleteVendorProduct' => ['auth' => true, 'run' => [self::class, 'deleteVendorProduct']],
            'vendor/saveVendorStore' => ['auth' => true, 'run' => [self::class, 'saveVendorStore']],
            'vendor/toggleVendorStore' => ['auth' => true, 'run' => [self::class, 'toggleVendorStore']],
        ];
    }

    public static function vendorCatalogue(array $data, array $user): array
    {
        $store = Fns::myStore($user);
        if (!$store) return ['store' => null, 'products' => []];
        return [
            'store' => $store,
            'products' => Store::filter('Product', ['store_id' => $store['id']], ['sort' => 'name', 'limit' => 200]),
        ];
    }

    public static function createVendorProduct(array $data, array $user): array
    {
        $store = self::ownStore($user);
        $name = self::productName($data);
        $product = Store::create('Product', [
            'name' => $name,
            'price' => Fns::number($data['price'] ?? 0) ?? 0.0,
            'stock' => (int) round(Fns::number($data['stock'] ?? 0) ?? 0),
            'unit' => Fns::str($data['unit'] ?? '') ?: '1 portion',
            'category' => Fns::str($data['category'] ?? ''),
            'description' => Fns::str($data['description'] ?? ''),
            'image_url' => Fns::str($data['image_url'] ?? ''),
            'emoji' => Fns::str($data['emoji'] ?? ''),
            'is_available' => array_key_exists('is_available', $data) ? (bool) $data['is_available'] : true,
            'store_id' => $store['id'],
            'store_name' => $store['name'] ?? '',
            'owner_email' => Fns::userEmail($user),
            'tint' => 'bg-[#F6EEFB]',
        ]);
        Fns::audit($user, 'product.create', $product['name'], 'Added to ' . Fns::str($store['name'] ?? ''));
        return $product;
    }

    public static function updateVendorProduct(array $data, array $user): array
    {
        $store = self::ownStore($user);
        $id = Fns::str($data['id'] ?? '');
        $current = null;
        try {
            $current = Store::get('Product', $id);
        } catch (Throwable) {
            $current = null;
        }
        $owned = $current
            && (($current['store_id'] ?? null) === $store['id'] || ($current['owner_email'] ?? null) === Fns::userEmail($user));
        if (!$owned) Fns::fail(403, 'That item is not part of your store.');

        $patch = [];
        foreach (['name', 'unit', 'category', 'description', 'image_url', 'emoji', 'is_available'] as $field) {
            if (!array_key_exists($field, $data)) continue;
            $patch[$field] = $field === 'is_available' ? (bool) $data[$field] : Fns::str($data[$field]);
        }
        if (array_key_exists('price', $data)) $patch['price'] = Fns::number($data['price']) ?? 0.0;
        if (array_key_exists('stock', $data)) $patch['stock'] = (int) round(Fns::number($data['stock']) ?? 0);
        if (isset($patch['name'])) self::productName(['name' => $patch['name']]);
        return Store::update('Product', $id, $patch);
    }

    public static function deleteVendorProduct(array $data, array $user): array
    {
        $store = self::ownStore($user);
        $id = Fns::str($data['id'] ?? '');
        $current = null;
        try {
            $current = Store::get('Product', $id);
        } catch (Throwable) {
            $current = null;
        }
        $owned = $current
            && (($current['store_id'] ?? null) === $store['id'] || ($current['owner_email'] ?? null) === Fns::userEmail($user));
        if (!$owned) Fns::fail(403, 'That item is not part of your store.');

        Store::delete('Product', $id);
        Fns::audit($user, 'product.delete', $current['name'] ?? '', 'Removed from ' . Fns::str($store['name'] ?? ''));
        return ['ok' => true];
    }

    public static function saveVendorStore(array $data, array $user): array
    {
        $store = self::ownStore($user);
        $patch = [];
        foreach (['name', 'category', 'tagline', 'promo', 'address', 'area', 'phone', 'logo_url', 'cover_url'] as $field) {
            if (array_key_exists($field, $data)) $patch[$field] = Fns::str($data[$field]);
        }
        foreach (['delivery_fee', 'min_order', 'eta_min', 'eta_max'] as $field) {
            if (array_key_exists($field, $data)) $patch[$field] = Fns::number($data[$field]) ?? 0.0;
        }
        if (array_key_exists('is_open', $data)) $patch['is_open'] = (bool) $data['is_open'];
        if (array_key_exists('photos', $data) && is_array($data['photos'])) {
            $patch['photos'] = array_values(array_map(fn ($photo) => Fns::str($photo), $data['photos']));
        }
        if (isset($patch['name']) && $patch['name'] !== ($store['name'] ?? null)) {
            Store::updateMany('Product', ['store_id' => $store['id']], ['$set' => ['store_name' => $patch['name']]]);
        }
        $updated = Store::update('Store', (string) $store['id'], $patch);
        Fns::audit($user, 'store.update', $updated['name'] ?? '', 'Storefront details saved');
        return $updated;
    }

    public static function toggleVendorStore(array $data, array $user): array
    {
        $store = self::ownStore($user);
        $isOpen = (bool) ($data['is_open'] ?? false);
        $updated = Store::update('Store', (string) $store['id'], ['is_open' => $isOpen]);
        Fns::audit($user, 'store.toggle', $updated['name'] ?? '', $isOpen ? 'Store opened for orders' : 'Store paused');
        return $updated;
    }

    private static function ownStore(array $user): array
    {
        $store = Fns::myStore($user);
        if (!$store) Fns::fail(403, 'No store is linked to your account yet.');
        return $store;
    }

    private static function productName(array $data): string
    {
        $name = trim(Fns::str($data['name'] ?? ''));
        if (mb_strlen($name) < 2) Fns::fail(400, 'Give the item a name.');
        return mb_substr($name, 0, 90);
    }

    private function __construct() {}
}
