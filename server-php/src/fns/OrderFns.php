<?php
// Port of src/lib/order-fns.js: customer orders, checkout, vendor insights and
// rider assignments.
declare(strict_types=1);

final class OrderFns
{
    private const ACTIVE = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'rider_assigned', 'picked_up'];

    public static function registry(): array
    {
        return [
            'order/listMyOrders' => ['auth' => true, 'run' => [self::class, 'listMyOrders']],
            'order/getMyOrder' => ['auth' => true, 'run' => [self::class, 'getMyOrder']],
            'order/placeOrder' => ['auth' => true, 'run' => [self::class, 'placeOrder']],
            'order/vendorInsights' => ['auth' => true, 'run' => [self::class, 'vendorInsights']],
            'order/riderAssignments' => ['auth' => true, 'run' => [self::class, 'riderAssignments']],
        ];
    }

    public static function listMyOrders(array $data, array $user): array
    {
        return Store::filter(
            'Order',
            ['customer_email' => Fns::userEmail($user)],
            ['sort' => '-created_date', 'limit' => 60]
        );
    }

    public static function getMyOrder(array $data, array $user): ?array
    {
        try {
            $order = Store::get('Order', Fns::str($data['id'] ?? ''));
        } catch (Throwable $error) {
            if ((int) $error->getCode() === 404) return null;
            throw $error;
        }
        $email = Fns::userEmail($user);
        $allowed = ($user['role'] ?? null) === 'admin'
            || in_array($email, [
                Fns::str($order['customer_email'] ?? ''),
                Fns::str($order['owner_email'] ?? ''),
                Fns::str($order['rider_email'] ?? ''),
            ], true);
        if (!$allowed) Fns::fail(403, 'You cannot open this order.');
        return $order;
    }

    public static function placeOrder(array $data, array $user): array
    {
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        if (!$items) Fns::fail(400, 'Your basket is empty.');
        if (count($items) > 40) Fns::fail(400, 'That is too many items for one order.');

        $ids = Fns::unique(array_map(fn ($item) => Fns::str($item['product_id'] ?? ''), $items));
        $products = Store::filter('Product', ['id' => ['$in' => $ids]]);

        $priced = [];
        foreach ($items as $line) {
            $product = null;
            foreach ($products as $candidate) {
                if (($candidate['id'] ?? null) === Fns::str($line['product_id'] ?? '')) {
                    $product = $candidate;
                    break;
                }
            }
            if (!$product || ($product['is_available'] ?? null) === false) continue;
            $qty = (int) round(Fns::number($line['qty'] ?? 0) ?? 0);
            if ($qty < 1) $qty = 1;
            $priced[] = [
                'product_id' => $product['id'],
                'name' => $product['name'] ?? '',
                'qty' => $qty,
                'unit_price' => Fns::number($product['price'] ?? null) ?? 0.0,
                'options' => [],
                'store_id' => $product['store_id'] ?? null,
            ];
        }

        if (!$priced) Fns::fail(409, 'Those items are no longer available.');
        $storeIds = Fns::unique(array_map(fn ($line) => $line['store_id'], $priced));
        if (count($storeIds) > 1) Fns::fail(409, 'Your basket can only hold items from one store.');

        $store = Store::get('Store', Fns::str($priced[0]['store_id']));
        $subtotal = 0;
        foreach ($priced as $line) $subtotal += $line['unit_price'] * $line['qty'];
        $deliveryFee = array_key_exists('delivery_fee', $store) && $store['delivery_fee'] !== null
            ? (float) (Fns::number($store['delivery_fee']) ?? 0)
            : 500.0;
        $serviceFee = (int) round($subtotal * 0.05);

        $promo = null;
        $code = Fns::str($data['promo_code'] ?? '');
        if ($code !== '') {
            $code = strtoupper(trim($code));
            $promo = Fns::findOne('PromoCode', ['code' => $code]);
        }
        $discount = 0;
        if ($code !== '') {
            $problem = Fns::promoProblem($promo, $subtotal, Fns::str($store['id'] ?? ''));
            if ($problem) Fns::fail(409, $problem);
            $discount = Fns::promoDiscount($promo, $subtotal);
        }
        $total = (int) round($subtotal + $deliveryFee + $serviceFee - $discount);
        $fees = Fns::loadFees();

        $paymentMethod = Fns::str($data['payment_method'] ?? '');
        $order = Store::create('Order', [
            'code' => 'AV-' . substr((string) ((int) floor(microtime(true) * 1000)), -6) . random_int(0, 8),
            'customer_email' => Fns::userEmail($user),
            'customer_name' => Fns::displayName($user),
            'customer_phone' => Fns::str($data['address_phone'] ?? ''),
            'store_id' => $store['id'],
            'store_name' => $store['name'] ?? '',
            'owner_email' => $store['owner_email'] ?? '',
            'items' => array_map(function ($line) {
                unset($line['store_id']);
                return $line;
            }, $priced),
            'subtotal' => $subtotal,
            'delivery_fee' => $deliveryFee,
            'service_fee' => $serviceFee,
            'discount' => $discount,
            'promo_code' => $promo['code'] ?? '',
            'total' => $total,
            'status' => 'placed',
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentMethod === 'cash' ? 'cash_due' : 'pending',
            'address_label' => Fns::str($data['address_label'] ?? '') ?: 'Delivery',
            'address_line' => Fns::str($data['address_line'] ?? ''),
            'address_area' => Fns::str($data['address_area'] ?? '') ?: Fns::str($store['area'] ?? ''),
            'address_phone' => Fns::str($data['address_phone'] ?? ''),
            'notes' => Fns::str($data['notes'] ?? ''),
            'rider_payout' => (int) round($deliveryFee * (1 - (float) $fees['riderPct'] / 100)),
            'timeline' => [[
                'status' => 'placed',
                'at' => Fns::nowIso(),
                'note' => 'Order placed',
                'by' => Fns::userEmail($user),
            ]],
        ]);

        Store::create('Payment', [
            'order_id' => $order['id'],
            'order_code' => $order['code'],
            'customer_email' => Fns::userEmail($user),
            'amount' => $total,
            'method' => $paymentMethod,
            'status' => $paymentMethod === 'cash' ? 'cash_pending' : 'pending',
            'provider' => 'avora',
            'note' => $paymentMethod === 'cash' ? 'Collect cash on delivery' : 'Card payment on delivery',
        ]);

        if ($promo) {
            Store::update('PromoCode', (string) $promo['id'], ['used_count' => (int) ($promo['used_count'] ?? 0) + 1]);
        }

        return ['id' => $order['id'], 'code' => $order['code'], 'total' => $total, 'discount' => $discount];
    }

    public static function vendorInsights(array $data, array $user): array
    {
        $store = Fns::myStore($user);
        if (!$store) {
            return ['store' => null, 'totals' => null, 'days' => [], 'topProducts' => [], 'statusMix' => [], 'recent' => []];
        }

        $orders = Store::filter('Order', ['store_id' => $store['id']], ['sort' => '-created_date', 'limit' => 300]);
        $delivered = array_values(array_filter($orders, fn ($order) => ($order['status'] ?? null) === 'delivered'));
        $active = array_values(array_filter($orders, fn ($order) => in_array($order['status'] ?? null, self::ACTIVE, true)));

        $days = [];
        for ($i = 13; $i >= 0; $i -= 1) {
            $key = gmdate('Y-m-d', strtotime("-{$i} days"));
            $dayOrders = array_values(array_filter(
                $orders,
                fn ($order) => Fns::dayKey($order['created_date'] ?? null) === $key
            ));
            $sales = 0;
            foreach ($dayOrders as $order) {
                if (($order['status'] ?? null) === 'delivered') $sales += (float) ($order['total'] ?? 0);
            }
            $days[] = ['date' => substr($key, 5), 'sales' => $sales, 'orders' => count($dayOrders)];
        }

        $productMap = [];
        foreach ($delivered as $order) {
            foreach (($order['items'] ?? []) as $item) {
                $name = Fns::str($item['name'] ?? '');
                $bucket = $productMap[$name] ?? ['name' => $name, 'qty' => 0, 'revenue' => 0];
                $bucket['qty'] += (int) ($item['qty'] ?? 0);
                $bucket['revenue'] += (float) ($item['unit_price'] ?? 0) * (float) ($item['qty'] ?? 0);
                $productMap[$name] = $bucket;
            }
        }
        $topProducts = array_values($productMap);
        usort($topProducts, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        $statusMap = [];
        foreach ($orders as $order) {
            $status = Fns::str($order['status'] ?? '');
            $statusMap[$status] = ($statusMap[$status] ?? 0) + 1;
        }
        $statusMix = [];
        foreach ($statusMap as $status => $count) $statusMix[] = ['status' => $status, 'count' => $count];

        $sales = 0;
        $vendable = 0;
        foreach ($delivered as $order) {
            $sales += (float) ($order['total'] ?? 0);
            $vendable += (float) ($order['subtotal'] ?? 0);
        }
        $fees = Fns::loadFees();
        $rate = $store['commission_rate'] ?? ((float) $fees['vendorPct'] / 100);

        return [
            'store' => $store,
            'days' => $days,
            'totals' => [
                'sales' => $sales,
                'commission' => (int) round($vendable * (float) $rate),
                'orders' => count($orders),
                'live' => count($active),
                'delivered' => count($delivered),
                'avgOrder' => $delivered ? (int) round($sales / count($delivered)) : 0,
                'products' => count(Store::filter('Product', ['store_id' => $store['id']])),
            ],
            'topProducts' => array_slice($topProducts, 0, 6),
            'statusMix' => $statusMix,
            'recent' => array_slice($orders, 0, 5),
        ];
    }

    public static function riderAssignments(array $data, array $user): array
    {
        $rider = Fns::myRider($user);
        if (!$rider) return ['rider' => null, 'active' => [], 'history' => []];

        $orders = Store::filter(
            'Order',
            ['rider_email' => Fns::userEmail($user)],
            ['sort' => '-created_date', 'limit' => 60]
        );
        $live = ['rider_assigned', 'picked_up'];
        return [
            'rider' => $rider,
            'active' => array_values(array_filter($orders, fn ($order) => in_array($order['status'] ?? null, $live, true))),
            'history' => array_values(array_filter($orders, fn ($order) => !in_array($order['status'] ?? null, $live, true))),
        ];
    }

    private function __construct() {}
}
