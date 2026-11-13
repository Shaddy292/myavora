<?php
// The PHP port of src/server/seed.js. Runs on first boot (empty database)
// when AVORA_DEMO is on, inserting the same demo dataset. The demo admin's
// password is bcrypt-hashed from AVORA_DEMO_PASSWORD.
declare(strict_types=1);

final class Seed
{
    private static function iso(int $offsetDays = 0): string
    {
        return gmdate('Y-m-d\TH:i:s.v\Z', time() - $offsetDays * 86400);
    }

    private static function img(string $id, int $w = 900): string
    {
        return "https://images.unsplash.com/{$id}?auto=format&fit=crop&w={$w}&q=70";
    }

    public static function run(): void
    {
        if (!Config::get('demo')) return;
        $count = (int) Db::pdo()->query('SELECT COUNT(*) FROM entities')->fetchColumn();
        if ($count > 0) return;

        $demoEmail = 'demo@avora.app';
        $demoName = 'Demo Admin';

        $categories = [
            ['id' => 'cat-restaurants', 'name' => 'Restaurants', 'emoji' => '🍽️', 'tint' => 'bg-[#FFF1E4]', 'position' => 1, 'is_active' => true],
            ['id' => 'cat-groceries', 'name' => 'Groceries', 'emoji' => '🛒', 'tint' => 'bg-[#EAF6EE]', 'position' => 2, 'is_active' => true],
            ['id' => 'cat-pharmacy', 'name' => 'Pharmacy', 'emoji' => '💊', 'tint' => 'bg-[#E9EEFB]', 'position' => 3, 'is_active' => true],
            ['id' => 'cat-drinks', 'name' => 'Drinks', 'emoji' => '🥤', 'tint' => 'bg-[#F3EAFB]', 'position' => 4, 'is_active' => true],
            ['id' => 'cat-bakery', 'name' => 'Bakery', 'emoji' => '🥐', 'tint' => 'bg-[#FBF3E2]', 'position' => 5, 'is_active' => true],
            ['id' => 'cat-essentials', 'name' => 'Essentials', 'emoji' => '🧺', 'tint' => 'bg-[#F6EEFB]', 'position' => 6, 'is_active' => true],
        ];

        $stores = [
            ['id' => 'store-avora-kitchen', 'name' => 'Avora Kitchen', 'category' => 'Restaurants', 'tagline' => 'Jollof, grills & local classics', 'cover_url' => self::img('photo-1504674900247-0877df9cc836'), 'photos' => [self::img('photo-1504674900247-0877df9cc836')], 'rating' => 4.8, 'eta_min' => 20, 'eta_max' => 35, 'delivery_fee' => 500, 'min_order' => 1500, 'promo' => '20% off', 'area' => 'Lekki Phase 1', 'address' => '12 Admiralty Way, Lekki', 'phone' => '+234 801 111 2222', 'owner_email' => $demoEmail, 'owner_name' => $demoName, 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-fresh-basket', 'name' => 'Fresh Basket Market', 'category' => 'Groceries', 'tagline' => 'Farm produce delivered daily', 'cover_url' => self::img('photo-1542838132-92c53300491e'), 'photos' => [self::img('photo-1542838132-92c53300491e')], 'rating' => 4.6, 'eta_min' => 25, 'eta_max' => 40, 'delivery_fee' => 700, 'min_order' => 2000, 'promo' => '', 'area' => 'Ikoyi', 'address' => '4 Glover Road, Ikoyi', 'phone' => '+234 802 333 4444', 'owner_email' => 'vendor.groceries@avora.app', 'owner_name' => 'Fresh Basket', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-green-cross', 'name' => 'Green Cross Pharmacy', 'category' => 'Pharmacy', 'tagline' => '24/7 health & wellness', 'cover_url' => self::img('photo-1587854692152-cbe660dbde88'), 'photos' => [], 'rating' => 4.7, 'eta_min' => 15, 'eta_max' => 25, 'delivery_fee' => 400, 'min_order' => 0, 'promo' => 'Free delivery', 'area' => 'Victoria Island', 'address' => '1 Adeola Odeku, VI', 'phone' => '+234 803 555 6666', 'owner_email' => 'vendor.pharmacy@avora.app', 'owner_name' => 'Green Cross', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-suya-republic', 'name' => 'Suya Republic', 'category' => 'Restaurants', 'tagline' => 'Charcoal-grilled suya & peppersoup', 'cover_url' => self::img('photo-1555939594-58d7cb561ad1'), 'photos' => [], 'rating' => 4.9, 'eta_min' => 30, 'eta_max' => 45, 'delivery_fee' => 600, 'min_order' => 1000, 'promo' => '', 'area' => 'Yaba', 'address' => '8 Herbert Macaulay Way, Yaba', 'phone' => '+234 804 777 8888', 'owner_email' => 'vendor.suya@avora.app', 'owner_name' => 'Suya Republic', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-crust-co', 'name' => 'Crust & Co Bakery', 'category' => 'Bakery', 'tagline' => 'Sourdough, croissants & cakes', 'cover_url' => self::img('photo-1509440159596-0249088772ff'), 'photos' => [], 'rating' => 4.5, 'eta_min' => 20, 'eta_max' => 35, 'delivery_fee' => 500, 'min_order' => 0, 'promo' => 'Buy 2 get 1', 'area' => 'Ikeja GRA', 'address' => '22 Isaac John, Ikeja', 'phone' => '+234 805 999 0000', 'owner_email' => 'vendor.bakery@avora.app', 'owner_name' => 'Crust & Co', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-chill-bar', 'name' => 'Chill Bar', 'category' => 'Drinks', 'tagline' => 'Smoothies, mocktails & iced tea', 'cover_url' => self::img('photo-1544145945-f90425340c7e'), 'photos' => [], 'rating' => 4.4, 'eta_min' => 15, 'eta_max' => 30, 'delivery_fee' => 450, 'min_order' => 0, 'promo' => '', 'area' => 'Surulere', 'address' => '5 Adeniran Ogunsanya, Surulere', 'phone' => '+234 806 121 3141', 'owner_email' => 'vendor.drinks@avora.app', 'owner_name' => 'Chill Bar', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-mama-put', 'name' => 'Mama Put Express', 'category' => 'Restaurants', 'tagline' => 'Home-style rice, stew & swallow', 'cover_url' => self::img('photo-1546069901-ba9599a7e63c'), 'photos' => [], 'rating' => 4.3, 'eta_min' => 25, 'eta_max' => 40, 'delivery_fee' => 350, 'min_order' => 800, 'promo' => '', 'area' => 'Gbagada', 'address' => '3 Diya Street, Gbagada', 'phone' => '+234 807 141 5161', 'owner_email' => 'vendor.mamaput@avora.app', 'owner_name' => 'Mama Put', 'is_approved' => true, 'is_open' => true],
            ['id' => 'store-sunrise-pharm', 'name' => 'Sunrise Pharmacy', 'category' => 'Pharmacy', 'tagline' => 'Prescriptions in under 30 minutes', 'cover_url' => self::img('photo-1631549916768-4119b2e5f926'), 'photos' => [], 'rating' => 4.6, 'eta_min' => 20, 'eta_max' => 35, 'delivery_fee' => 500, 'min_order' => 0, 'promo' => '', 'area' => 'Ajah', 'address' => '14 Addo Road, Ajah', 'phone' => '+234 808 171 8191', 'owner_email' => 'vendor.sunrise@avora.app', 'owner_name' => 'Sunrise Pharmacy', 'is_approved' => true, 'is_open' => true],
        ];

        $essentials = [
            ['name' => 'Ofada Rice (5kg)', 'price' => 9500, 'unit' => '5 kg bag', 'emoji' => '🍚', 'category' => 'Grains'],
            ['name' => 'Sunflower Oil (3L)', 'price' => 7200, 'unit' => '3 litre', 'emoji' => '🫗', 'category' => 'Pantry'],
            ['name' => 'Fresh Tomatoes', 'price' => 1800, 'unit' => '1 basket', 'emoji' => '🍅', 'category' => 'Produce'],
            ['name' => 'Brown Eggs', 'price' => 3200, 'unit' => 'Crate of 30', 'emoji' => '🥚', 'category' => 'Dairy'],
            ['name' => 'Peak Milk (400g)', 'price' => 2600, 'unit' => '400 g tin', 'emoji' => '🥛', 'category' => 'Dairy'],
            ['name' => 'Golden Penny Semovita', 'price' => 3400, 'unit' => '1 kg', 'emoji' => '🌾', 'category' => 'Grains'],
            ['name' => 'Titus Sardine', 'price' => 1500, 'unit' => 'Pack of 3', 'emoji' => '🐟', 'category' => 'Pantry'],
            ['name' => 'Bananas (bunch)', 'price' => 1200, 'unit' => '1 bunch', 'emoji' => '🍌', 'category' => 'Produce'],
            ['name' => 'Dettol Soap', 'price' => 900, 'unit' => '1 bar', 'emoji' => '🧼', 'category' => 'Care'],
            ['name' => 'Bottled Water (75cl)', 'price' => 600, 'unit' => 'Pack of 12', 'emoji' => '💧', 'category' => 'Drinks'],
            ['name' => 'Oatmeal (1kg)', 'price' => 2900, 'unit' => '1 kg', 'emoji' => '🥣', 'category' => 'Pantry'],
            ['name' => 'Fresh Chicken', 'price' => 4800, 'unit' => '1.5 kg', 'emoji' => '🍗', 'category' => 'Protein'],
        ];

        $menus = [
            'store-avora-kitchen' => [
                ['Party Jollof Rice', 3500, 'Smoky jollof with grilled chicken', '🍛'],
                ['Egusi Soup & Pounded Yam', 4200, 'Melon seed soup, assorted meat', '🥘'],
                ['Peppered Goat Meat', 5000, 'Charcoal-grilled, extra pepper', '🍖'],
                ['Seafood Fried Rice', 4500, 'Prawns, calamari, sweet corn', '🍤'],
                ['Puff Puff (6 pcs)', 1200, 'Golden, fluffy, sugar-dusted', '🧆'],
            ],
            'store-suya-republic' => [
                ['Beef Suya Wrap', 2800, 'Yaji-spiced beef, onion, tomato', '🌯'],
                ['Chicken Suya Platter', 4000, 'With extra yaji & onions', '🍢'],
                ['Catfish Peppersoup', 5200, 'Spicy broth, fresh catfish', '🐟'],
                ['Asun (Peppered Goat)', 4800, 'Smoky, diced, fiery', '🌶️'],
            ],
            'store-mama-put' => [
                ['White Rice & Stew', 1800, 'With fried plantain', '🍚'],
                ['Eba & Efo Riro', 2200, 'Spinach stew, assorted meat', '🥬'],
                ['Amala & Abula', 2400, 'Gbegiri, ewedu, stew', '🍲'],
                ['Beans & Plantain', 1600, 'Honey beans, ripe plantain', '🍌'],
            ],
            'store-fresh-basket' => [
                ['Organic Avocados', 2400, 'Pack of 4', '🥑'],
                ['Fresh Spinach Bunch', 800, '1 bunch', '🥬'],
                ['Whole Watermelon', 2600, 'Large, sweet', '🍉'],
                ['Irish Potatoes (2kg)', 3200, 'Washed & sorted', '🥔'],
            ],
            'store-chill-bar' => [
                ['Mango Smoothie', 2000, 'Fresh mango, yoghurt', '🥭'],
                ['Zobo (1L)', 1500, 'Hibiscus, ginger, pineapple', '🧋'],
                ['Chapman', 1800, 'The Lagos classic', '🍹'],
                ['Iced Lemon Tea', 1600, 'House-brewed', '🧊'],
            ],
            'store-crust-co' => [
                ['Sourdough Loaf', 3200, '48-hour ferment', '🍞'],
                ['Butter Croissant', 1200, 'French butter', '🥐'],
                ['Red Velvet Slice', 2500, 'Cream cheese frosting', '🍰'],
                ['Cinnamon Roll', 1400, 'Warm glaze', '🥮'],
            ],
            'store-green-cross' => [
                ['Paracetamol (500mg)', 900, 'Pack of 20', '💊'],
                ['Vitamin C 1000mg', 2500, '30 tablets', '🍊'],
                ['Hand Sanitiser', 1400, '500 ml', '🧴'],
                ['First Aid Kit', 6500, 'Home essentials', '🩹'],
            ],
            'store-sunrise-pharm' => [
                ['Multivitamin Pack', 3800, '30 capsules', '💊'],
                ['Digital Thermometer', 4500, 'Fast read', '🌡️'],
                ['Cough Syrup', 2200, '200 ml', '🍯'],
                ['Face Masks (50)', 2800, '3-ply', '😷'],
            ],
        ];

        $storeById = array_column($stores, null, 'id');
        $products = [];
        foreach ($essentials as $index => $item) {
            $products[] = [
                'id' => 'product-essential-' . ($index + 1),
                'store_id' => 'store-fresh-basket',
                'store_name' => 'Fresh Basket Market',
                'owner_email' => 'vendor.groceries@avora.app',
                'name' => $item['name'],
                'price' => $item['price'],
                'unit' => $item['unit'],
                'emoji' => $item['emoji'],
                'category' => $item['category'],
                'tint' => 'bg-[#F6EEFB]',
                'is_available' => true,
                'stock' => 40,
            ];
        }
        $counter = 0;
        foreach ($menus as $storeId => $items) {
            $store = $storeById[$storeId] ?? null;
            foreach ($items as [$name, $price, $description, $emoji]) {
                $counter += 1;
                $products[] = [
                    'id' => "product-menu-{$counter}",
                    'store_id' => $storeId,
                    'store_name' => $store['name'] ?? '',
                    'owner_email' => $store['owner_email'] ?? '',
                    'name' => $name,
                    'description' => $description,
                    'price' => $price,
                    'unit' => $description,
                    'emoji' => $emoji,
                    'category' => $store['category'] ?? '',
                    'tint' => 'bg-[#FFF6EC]',
                    'is_available' => true,
                    'stock' => 25,
                ];
            }
        }

        $base = [
            'customer_email' => $demoEmail,
            'customer_name' => $demoName,
            'customer_phone' => '+234 809 000 0000',
            'address' => '12 Admiralty Way, Lekki Phase 1',
            'city' => 'Lagos',
            'delivery_fee' => 500,
            'service_fee' => 250,
            'payment_method' => 'card',
            'payment_status' => 'paid',
        ];
        $orders = [
            array_merge($base, ['id' => 'order-active-1', 'code' => 'AV-10482', 'store_id' => 'store-avora-kitchen', 'store_name' => 'Avora Kitchen', 'status' => 'preparing', 'total' => 7750, 'items' => [['name' => 'Party Jollof Rice', 'qty' => 1, 'unit_price' => 3500], ['name' => 'Peppered Goat Meat', 'qty' => 1, 'unit_price' => 5000]], 'timeline' => [['status' => 'placed', 'at' => self::iso(0)], ['status' => 'accepted', 'at' => self::iso(0)], ['status' => 'preparing', 'at' => self::iso(0)]], 'created_offset' => 0]),
            array_merge($base, ['id' => 'order-past-1', 'code' => 'AV-10311', 'store_id' => 'store-fresh-basket', 'store_name' => 'Fresh Basket Market', 'status' => 'delivered', 'total' => 5300, 'rating' => 5, 'items' => [['name' => 'Fresh Tomatoes', 'qty' => 1, 'unit_price' => 1800], ['name' => 'Brown Eggs', 'qty' => 1, 'unit_price' => 3200]], 'timeline' => [['status' => 'placed', 'at' => self::iso(6)], ['status' => 'delivered', 'at' => self::iso(6)]], 'created_offset' => 6]),
            array_merge($base, ['id' => 'order-past-2', 'code' => 'AV-10244', 'store_id' => 'store-suya-republic', 'store_name' => 'Suya Republic', 'status' => 'delivered', 'total' => 4600, 'rating' => 4, 'items' => [['name' => 'Beef Suya Wrap', 'qty' => 1, 'unit_price' => 2800]], 'timeline' => [['status' => 'placed', 'at' => self::iso(14)], ['status' => 'delivered', 'at' => self::iso(14)]], 'created_offset' => 14]),
            array_merge($base, ['id' => 'order-past-3', 'code' => 'AV-10102', 'store_id' => 'store-crust-co', 'store_name' => 'Crust & Co Bakery', 'status' => 'delivered', 'total' => 4400, 'rating' => 5, 'items' => [['name' => 'Sourdough Loaf', 'qty' => 1, 'unit_price' => 3200]], 'timeline' => [['status' => 'placed', 'at' => self::iso(21)], ['status' => 'delivered', 'at' => self::iso(21)]], 'created_offset' => 21]),
            array_merge($base, ['id' => 'order-other-1', 'customer_email' => 'ada@example.com', 'customer_name' => 'Ada Obi', 'code' => 'AV-10483', 'store_id' => 'store-avora-kitchen', 'store_name' => 'Avora Kitchen', 'status' => 'placed', 'total' => 4200, 'items' => [['name' => 'Egusi Soup & Pounded Yam', 'qty' => 1, 'unit_price' => 4200]], 'timeline' => [['status' => 'placed', 'at' => self::iso(0)]], 'created_offset' => 0]),
            array_merge($base, ['id' => 'order-other-2', 'customer_email' => 'tunde@example.com', 'customer_name' => 'Tunde Bello', 'code' => 'AV-10484', 'store_id' => 'store-avora-kitchen', 'store_name' => 'Avora Kitchen', 'status' => 'ready_for_pickup', 'total' => 4500, 'items' => [['name' => 'Seafood Fried Rice', 'qty' => 1, 'unit_price' => 4500]], 'timeline' => [['status' => 'placed', 'at' => self::iso(0)]], 'created_offset' => 0]),
            array_merge($base, ['id' => 'order-other-3', 'customer_email' => 'ada@example.com', 'customer_name' => 'Ada Obi', 'code' => 'AV-10461', 'store_id' => 'store-chill-bar', 'store_name' => 'Chill Bar', 'status' => 'cancelled', 'total' => 3300, 'cancel_reason' => 'Rider could not reach the customer', 'items' => [['name' => 'Mango Smoothie', 'qty' => 1, 'unit_price' => 2000]], 'timeline' => [['status' => 'placed', 'at' => self::iso(2)], ['status' => 'cancelled', 'at' => self::iso(2)]], 'created_offset' => 2]),
        ];

        $featured = array_map(
            fn ($c) => ['label' => $c['name'], 'emoji' => $c['emoji'], 'tint' => $c['tint']],
            $categories,
        );

        $tables = [
            'User' => [
                array_merge([
                    'id' => 'local-user-demo',
                    'email' => $demoEmail,
                    'full_name' => $demoName,
                    'role' => 'admin',
                ], ['password_hash' => password_hash((string) Config::get('demoPassword'), PASSWORD_BCRYPT)]),
            ],
            'StaffMember' => [
                ['id' => 'staff-demo', 'email' => $demoEmail, 'full_name' => $demoName, 'role' => 'admin', 'is_active' => true],
            ],
            'Category' => $categories,
            'Store' => $stores,
            'Product' => $products,
            'Review' => [
                ['id' => 'review-1', 'store_id' => 'store-avora-kitchen', 'user_email' => $demoEmail, 'user_name' => $demoName, 'rating' => 5, 'comment' => 'Fast delivery and the jollof was perfect.', 'is_hidden' => false, 'created_offset' => 6],
                ['id' => 'review-2', 'store_id' => 'store-fresh-basket', 'user_email' => 'ada@example.com', 'user_name' => 'Ada Obi', 'rating' => 4, 'comment' => 'Great produce, packaging could be better.', 'is_hidden' => false, 'created_offset' => 10],
            ],
            'PlatformContent' => [
                [
                    'id' => 'content-1',
                    'announcement_title' => 'Free delivery weekend',
                    'announcement_body' => 'Orders above ₦5,000 get free delivery across Lagos this weekend.',
                    'announcement_tone' => 'purple',
                    'announcement_active' => true,
                    'banners' => [
                        ['title' => 'Craving something?', 'body' => 'Top restaurants near you, delivered in 30 minutes.', 'image_url' => self::img('photo-1504674900247-0877df9cc836', 1200), 'link' => '/', 'is_active' => true],
                        ['title' => 'Market run, sorted', 'body' => 'Fresh produce and everyday essentials at your door.', 'image_url' => self::img('photo-1542838132-92c53300491e', 1200), 'link' => '/', 'is_active' => true],
                    ],
                    'featured_categories' => $featured,
                    'created_offset' => 30,
                ],
            ],
            'PlatformSetting' => [
                ['id' => 'settings-1', 'business_name' => 'AVORA', 'legal_name' => 'Avora Delivery Services Ltd', 'support_email' => 'support@avora.app', 'support_phone' => '+234 700 000 0000', 'service_fee_pct' => 5, 'delivery_base_fee' => 500, 'min_order_value' => 0, 'created_offset' => 120],
            ],
            'PromoCode' => [
                ['id' => 'promo-1', 'code' => 'AVORA10', 'description' => '10% off your order', 'discount_type' => 'percent', 'value' => 10, 'is_active' => true, 'used_count' => 12, 'created_offset' => 15],
                ['id' => 'promo-2', 'code' => 'FREE500', 'description' => '₦500 off delivery', 'discount_type' => 'fixed', 'value' => 500, 'is_active' => true, 'used_count' => 3, 'created_offset' => 9],
            ],
            'Address' => [
                ['id' => 'address-1', 'user_email' => $demoEmail, 'label' => 'Home', 'line1' => '12 Admiralty Way', 'area' => 'Lekki Phase 1', 'city' => 'Lagos', 'phone' => '+234 809 000 0000', 'is_default' => true, 'created_offset' => 60],
                ['id' => 'address-2', 'user_email' => $demoEmail, 'label' => 'Office', 'line1' => '1 Adeola Odeku', 'area' => 'Victoria Island', 'city' => 'Lagos', 'phone' => '+234 809 000 0000', 'is_default' => false, 'created_offset' => 45],
            ],
            'PaymentMethod' => [
                ['id' => 'paymentmethod-1', 'user_email' => $demoEmail, 'brand' => 'Visa', 'last4' => '4242', 'expiry' => '08/28', 'is_default' => true, 'created_offset' => 40],
            ],
            'Order' => $orders,
            'Notification' => [
                ['id' => 'notification-1', 'user_email' => $demoEmail, 'title' => 'Order AV-10482 is being prepared', 'body' => 'Avora Kitchen has started cooking your order.', 'is_read' => false, 'created_offset' => 0],
                ['id' => 'notification-2', 'user_email' => $demoEmail, 'title' => 'Welcome to AVORA', 'body' => 'Your account is ready. Enjoy your first delivery on us.', 'is_read' => true, 'created_offset' => 20],
            ],
            'DeliveryZone' => [
                ['id' => 'zone-1', 'name' => 'Lekki', 'fee' => 500, 'eta_min' => 20, 'eta_max' => 35, 'is_active' => true, 'created_offset' => 60],
                ['id' => 'zone-2', 'name' => 'Victoria Island', 'fee' => 600, 'eta_min' => 25, 'eta_max' => 40, 'is_active' => true, 'created_offset' => 60],
                ['id' => 'zone-3', 'name' => 'Ikeja', 'fee' => 800, 'eta_min' => 30, 'eta_max' => 50, 'is_active' => true, 'created_offset' => 60],
            ],
            'SupportTicket' => [
                ['id' => 'ticket-1', 'topic' => 'Missing item', 'subject' => 'Egusi arrived without pounded yam', 'customer_email' => $demoEmail, 'order_code' => 'AV-10311', 'status' => 'open', 'priority' => 'high', 'assigned_to' => '', 'message' => 'The soup came but the pounded yam wrap was missing from the bag.', 'created_offset' => 1],
                ['id' => 'ticket-2', 'topic' => 'Late delivery', 'subject' => 'Order took over an hour', 'customer_email' => 'ada@example.com', 'order_code' => 'AV-10483', 'status' => 'open', 'priority' => 'urgent', 'assigned_to' => '', 'message' => 'I waited 70 minutes and the app still said matching a rider.', 'created_offset' => 0],
                ['id' => 'ticket-3', 'topic' => 'Payment', 'subject' => 'Card charged twice', 'customer_email' => 'tunde@example.com', 'order_code' => 'AV-10484', 'status' => 'open', 'priority' => 'normal', 'assigned_to' => 'support@avora.app', 'message' => 'I see two card charges for the same order.', 'created_offset' => 2],
                ['id' => 'ticket-4', 'topic' => 'Account', 'subject' => 'Cannot update phone number', 'customer_email' => $demoEmail, 'order_code' => '', 'status' => 'answered', 'priority' => 'normal', 'assigned_to' => 'support@avora.app', 'message' => 'The save button does nothing when I change my number.', 'created_offset' => 5],
            ],
            'Refund' => [
                ['id' => 'refund-1', 'order_code' => 'AV-10311', 'order_id' => 'order-past-1', 'customer_email' => $demoEmail, 'amount' => 1800, 'reason' => 'Missing item: fresh tomatoes never arrived.', 'status' => 'requested', 'note' => '', 'decided_by' => '', 'created_offset' => 1],
                ['id' => 'refund-2', 'order_code' => 'AV-10244', 'order_id' => 'order-past-2', 'customer_email' => $demoEmail, 'amount' => 4600, 'reason' => 'Order arrived cold and incomplete.', 'status' => 'approved', 'note' => 'Verified with rider; refund queued.', 'decided_by' => $demoEmail, 'created_offset' => 8],
                ['id' => 'refund-3', 'order_code' => 'AV-10102', 'order_id' => 'order-past-3', 'customer_email' => 'tunde@example.com', 'amount' => 4400, 'reason' => 'Duplicate charge on my card.', 'status' => 'requested', 'note' => '', 'decided_by' => '', 'created_offset' => 3],
            ],
        ];

        foreach ($tables as $entity => $rows) {
            foreach ($rows as $row) {
                $offset = (int) ($row['created_offset'] ?? 0);
                unset($row['created_offset']);
                $row['created_date'] = self::iso($offset);
                $row['updated_date'] = self::iso(min($offset, 1));
                Store::create($entity, $row);
            }
        }
    }

    private function __construct() {}
}
