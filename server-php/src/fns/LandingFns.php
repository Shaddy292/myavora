<?php
// Port of src/lib/landing-fns.js.
declare(strict_types=1);

final class LandingFns
{
    public static function registry(): array
    {
        return [
            'landing/resolveLandingRoute' => ['auth' => true, 'run' => [self::class, 'resolveLandingRoute']],
        ];
    }

    public static function resolveLandingRoute(array $data, ?array $user): array
    {
        $email = Fns::userEmail($user);
        if (($user['role'] ?? null) === 'admin') return ['path' => '/admin', 'role' => 'admin'];

        $staff = Store::filter('StaffMember', ['email' => $email, 'is_active' => true]);
        $stores = Store::filter('Store', ['owner_email' => $email]);
        $riders = Store::filter('RiderProfile', ['user_email' => $email]);

        $staffRole = $staff[0]['role'] ?? null;
        if ($staffRole) return ['path' => $staffRole === 'support' ? '/support-tickets' : '/admin', 'role' => $staffRole];
        if ($stores) return ['path' => '/vendor', 'role' => 'vendor'];
        if ($riders) return ['path' => '/rider', 'role' => 'rider'];
        return ['path' => '/dashboard', 'role' => 'customer'];
    }

    private function __construct() {}
}
