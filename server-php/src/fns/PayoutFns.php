<?php
// Port of src/lib/payout-fns.js: rider monthly payout series and the payout
// bank account on file.
declare(strict_types=1);

final class PayoutFns
{
    private const SUBJECTS = ['rider', 'vendor'];

    public static function registry(): array
    {
        return [
            'payout/riderMonthlyPayouts' => ['auth' => true, 'run' => [self::class, 'riderMonthlyPayouts']],
            'payout/getMyPayoutAccount' => ['auth' => true, 'run' => [self::class, 'getMyPayoutAccount']],
            'payout/saveMyPayoutAccount' => ['auth' => true, 'run' => [self::class, 'saveMyPayoutAccount']],
        ];
    }

    public static function riderMonthlyPayouts(array $data, array $user): array
    {
        if (!in_array(Fns::staffRole($user), ['admin', 'ops', 'finance'], true)) {
            Fns::fail(403, 'You do not have permission to open this area.');
        }
        $orders = Store::filter('Order', [], ['sort' => '-created_date', 'limit' => 500]);
        $keys = self::monthKeys();
        $byRider = [];

        foreach ($orders as $order) {
            if (($order['status'] ?? null) !== 'delivered' || empty($order['rider_email'])) continue;
            $stamp = Fns::str($order['delivered_at'] ?? '') ?: Fns::str($order['created_date'] ?? '');
            $key = substr($stamp, 0, 7);
            if (!in_array($key, $keys, true)) continue;
            $amount = (float) ($order['rider_payout'] ?? 0);
            $email = Fns::str($order['rider_email']);
            $entry = $byRider[$email] ?? [
                'name' => Fns::str($order['rider_name'] ?? '') ?: $email,
                'total' => 0.0,
                'amounts' => [],
            ];
            $entry['total'] += $amount;
            $entry['amounts'][$key] = ($entry['amounts'][$key] ?? 0) + $amount;
            $byRider[$email] = $entry;
        }

        $sorted = array_values($byRider);
        usort($sorted, fn ($a, $b) => $b['total'] <=> $a['total']);

        $series = [];
        foreach (array_slice($sorted, 0, 5) as $index => $entry) {
            $series[] = ['key' => "r{$index}", 'name' => $entry['name'], 'total' => $entry['total'], 'amounts' => $entry['amounts']];
        }

        $rest = array_slice($sorted, 5);
        if ($rest) {
            $amounts = [];
            $restTotal = 0.0;
            foreach ($rest as $entry) {
                $restTotal += $entry['total'];
                foreach ($keys as $key) {
                    if (!empty($entry['amounts'][$key])) {
                        $amounts[$key] = ($amounts[$key] ?? 0) + $entry['amounts'][$key];
                    }
                }
            }
            $series[] = ['key' => 'others', 'name' => 'Other riders (' . count($rest) . ')', 'total' => $restTotal, 'amounts' => $amounts];
        }

        $months = [];
        foreach ($keys as $key) {
            $row = [
                'key' => $key,
                'label' => gmdate('M', strtotime("{$key}-01T00:00:00Z")),
                'total' => 0.0,
            ];
            foreach ($series as $item) {
                $row[$item['key']] = $item['amounts'][$key] ?? 0;
                $row['total'] += $row[$item['key']];
            }
            $months[] = $row;
        }

        $grandTotal = 0.0;
        foreach ($months as $row) $grandTotal += $row['total'];

        return [
            'months' => $months,
            'series' => array_map(fn ($item) => ['key' => $item['key'], 'name' => $item['name'], 'total' => $item['total']], $series),
            'grandTotal' => $grandTotal,
            'riderCount' => count($sorted),
        ];
    }

    public static function getMyPayoutAccount(array $data, array $user): ?array
    {
        $subject = self::subject($data);
        return Fns::findOne('PayoutAccount', [
            'owner_email' => Fns::userEmail($user),
            'subject_type' => $subject,
        ]);
    }

    public static function saveMyPayoutAccount(array $data, array $user): array
    {
        $subject = self::subject($data);
        $bank = trim(Fns::str($data['bank_name'] ?? ''));
        $name = trim(Fns::str($data['account_name'] ?? ''));
        $number = trim(Fns::str($data['account_number'] ?? ''));
        if (mb_strlen($bank) < 2) Fns::fail(400, 'Enter your bank name.');
        if (mb_strlen($name) < 2) Fns::fail(400, 'Enter the account name.');
        if (!preg_match('/^\d{6,20}$/', $number)) Fns::fail(400, 'Enter a valid account number');

        $email = Fns::userEmail($user);
        $payload = [
            'owner_email' => $email,
            'subject_type' => $subject,
            'bank_name' => $bank,
            'account_name' => $name,
            'account_number' => $number,
            'payout_cycle' => 'daily',
        ];

        $existing = Fns::findOne('PayoutAccount', ['owner_email' => $email, 'subject_type' => $subject]);
        if ($existing) return Store::update('PayoutAccount', (string) $existing['id'], $payload);
        return Store::create('PayoutAccount', array_merge($payload, [
            'display_name' => Fns::displayName($user),
            'created_by_id' => $user['id'] ?? null,
        ]));
    }

    private static function subject(array $data): string
    {
        $subject = Fns::str($data['subject_type'] ?? '');
        if (!in_array($subject, self::SUBJECTS, true)) Fns::fail(400, 'Pick an account type.');
        return $subject;
    }

    /** @return string[] Six month keys ending with the current UTC month. */
    private static function monthKeys(int $count = 6): array
    {
        $keys = [];
        $year = (int) gmdate('Y');
        $month = (int) gmdate('n');
        for ($index = 0; $index < $count; $index += 1) {
            $offset = $month - ($count - 1 - $index);
            $keys[] = gmdate('Y-m', gmmktime(0, 0, 0, $offset, 1, $year));
        }
        return $keys;
    }

    private function __construct() {}
}
