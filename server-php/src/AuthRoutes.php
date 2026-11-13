<?php
// The PHP ports of src/routes/api/auth.*.js and users.invite.js.
declare(strict_types=1);

final class AuthRoutes
{
    public static function login(): void
    {
        $limited = self::limit('login', 10, 5 * 60 * 1000);
        if ($limited) return;
        try {
            $user = Auth::authenticate(Http::readJsonBody());
            Http::json(['user' => $user], 200, Auth::sessionCookies((string) $user['id']));
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    public static function register(): void
    {
        $limited = self::limit('register', 5, 10 * 60 * 1000);
        if ($limited) return;
        try {
            $user = Auth::registerUser(Http::readJsonBody());
            Http::json(['user' => $user], 200, Auth::sessionCookies((string) $user['id']));
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    public static function logout(): void
    {
        Http::json(['ok' => true], 200, Auth::clearSessionCookies());
    }

    public static function me(): void
    {
        $user = Auth::sessionUser();
        if (!$user) {
            Http::json(['error' => 'Unauthorized'], 401);
            return;
        }
        Http::json(['user' => $user]);
    }

    public static function forgotPassword(): void
    {
        $limited = self::limit('forgot-password', 3, 10 * 60 * 1000);
        if ($limited) return;
        $body = Http::readJsonBody();
        $token = Auth::createResetToken($body['email'] ?? '');
        if ($token) {
            $origin = self::origin();
            error_log("[avora-php] password reset for {$body['email']}: {$origin}/reset-password?token={$token}");
        }
        // Always the same answer: never reveal whether the email is registered.
        Http::json(['ok' => true]);
    }

    public static function resetPassword(): void
    {
        $limited = self::limit('reset-password', 10, 10 * 60 * 1000);
        if ($limited) return;
        try {
            $body = Http::readJsonBody();
            $user = Auth::consumeResetToken($body['token'] ?? $body['resetToken'] ?? '', $body['password'] ?? $body['newPassword'] ?? '');
            Http::json(['user' => $user], 200, Auth::sessionCookies((string) $user['id']));
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    public static function invite(): void
    {
        $user = Auth::sessionUser();
        if (!$user) {
            Http::json(['error' => 'Unauthorized'], 401);
            return;
        }
        $limited = self::limit('invite', 20, 60 * 60 * 1000);
        if ($limited) return;
        try {
            if ($user['role'] !== 'admin') throw new RuntimeException('Only administrators can do that', 403);
            $body = Http::readJsonBody();
            Http::json(self::inviteUser((string) ($body['email'] ?? '')));
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    public static function providers(): void
    {
        Http::json([
            'google' => (bool) Config::get('googleClientId') && (bool) Config::get('googleClientSecret'),
        ]);
    }

    // Google OAuth is ported in a later stage; until then these endpoints
    // answer exactly like the Node backend does when unconfigured.
    public static function google(): void
    {
        Http::json(['error' => 'Google sign-in is not configured on this server'], 501);
    }

    public static function googleCallback(): void
    {
        Http::redirect('/login?error=' . rawurlencode('Google sign-in is not configured on this server'));
    }

    // --- internals -------------------------------------------------------

    private static function inviteUser(string $email): array
    {
        $address = strtolower(trim($email));
        if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $address)) {
            throw new RuntimeException('Enter a valid email address', 400);
        }
        $rows = Store::filter('User', ['email' => $address]);
        if ($rows) {
            $user = $rows[0];
            unset($user['password_hash']);
            return ['ok' => true, 'user' => $user];
        }
        $user = Store::create('User', [
            'email' => $address,
            'full_name' => explode('@', $address)[0],
            'role' => 'user',
            'invited' => true,
            'password_hash' => password_hash(bin2hex(random_bytes(18)), PASSWORD_BCRYPT),
        ]);
        unset($user['password_hash']);
        return ['ok' => true, 'user' => $user];
    }

    private static function limit(string $scope, int $max, int $windowMs): bool
    {
        $result = RateLimit::check($scope, $max, $windowMs);
        if (!$result) return false;
        Http::json($result['body'], $result['status'], [], $result['headers']);
        return true;
    }

    private static function origin(): string
    {
        $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'https';
        $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
        return explode(',', $proto)[0] . '://' . trim(explode(',', $host)[0]);
    }

    private function __construct() {}
}
