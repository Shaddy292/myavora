<?php
// The PHP equivalent of src/server/auth.server.js. The session cookie format
// is byte-for-byte identical (userId.expiry.hmac-sha256) so a session minted
// by either backend works on the other.
//
// Passwords: NEW hashes use PHP's password_hash (bcrypt). The Node app's
// scrypt hashes ("salt:hex") are not verifiable in PHP by design — those
// accounts are asked to reset via forgot-password (the chosen migration).
declare(strict_types=1);

final class Auth
{
    private const SESSION_COOKIE = 'avora_session';
    private const MARKER_COOKIE = 'avora_signed_in';
    private const SESSION_SECONDS = 2592000; // 30 days
    private const RESET_MINUTES = 30;

    private static function secret(): string
    {
        $secret = (string) Config::get('secret');
        if (!$secret) {
            throw new RuntimeException('AVORA_SECRET is not configured', 500);
        }
        return $secret;
    }

    private static function sign(string $value): string
    {
        return hash_hmac('sha256', $value, self::secret());
    }

    // --- cookies ---------------------------------------------------------

    private static function cookie(string $name, string $value, int $maxAge): string
    {
        $secure = Config::get('secureCookies') ? ' Secure;' : '';
        return sprintf('%s=%s; Path=/; HttpOnly; SameSite=Lax;%s Max-Age=%d', $name, rawurlencode($value), $secure, $maxAge);
    }

    private static function marker(string $value): string
    {
        return sprintf('%s=%s; Path=/; SameSite=Lax; Max-Age=%d', self::MARKER_COOKIE, $value, $value ? self::SESSION_SECONDS : 0);
    }

    /** @return string[] */
    public static function sessionCookies(string $userId): array
    {
        $expires = time() + self::SESSION_SECONDS;
        $body = "{$userId}.{$expires}";
        return [self::cookie(self::SESSION_COOKIE, "{$body}." . self::sign($body), self::SESSION_SECONDS), self::marker('1')];
    }

    /** @return string[] */
    public static function clearSessionCookies(): array
    {
        return [self::cookie(self::SESSION_COOKIE, '', 0), self::marker('')];
    }

    /** @return array<string,string> */
    private static function parseCookies(): array
    {
        $cookies = [];
        foreach (explode(';', $_SERVER['HTTP_COOKIE'] ?? '') as $part) {
            $part = trim($part);
            if ($part === '' || !str_contains($part, '=')) continue;
            [$key, $value] = explode('=', $part, 2);
            $cookies[trim($key)] = rawurldecode($value);
        }
        return $cookies;
    }

    private static function verifySession(string $token): ?string
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$userId, $expires, $signature] = $parts;
        if (!hash_equals(self::sign("{$userId}.{$expires}"), $signature)) return null;
        if ((int) $expires * 1000 <= (int) floor(microtime(true) * 1000)) return null;
        return $userId;
    }

    // The signed-in user for the current request, or null. Strips password_hash.
    public static function sessionUser(): ?array
    {
        $userId = self::verifySession(self::parseCookies()[self::SESSION_COOKIE] ?? '');
        if (!$userId) return null;
        try {
            return self::publicUser(Store::get('User', $userId));
        } catch (Throwable) {
            return null;
        }
    }

    // --- users -----------------------------------------------------------

    private static function normalizeEmail(mixed $email): string
    {
        return strtolower(trim((string) $email));
    }

    private static function publicUser(?array $user): ?array
    {
        if (!$user) return null;
        unset($user['password_hash']);
        return $user;
    }

    private static function findUser(string $email): ?array
    {
        $rows = Store::filter('User', ['email' => $email]);
        return $rows[0] ?? null;
    }

    private static function isLegacyHash(mixed $hash): bool
    {
        return is_string($hash) && (bool) preg_match('/^[a-f0-9]{32}:[a-f0-9]+$/i', $hash);
    }

    private static function fail(int $status, string $message): never
    {
        throw new RuntimeException($message, $status);
    }

    public static function registerUser(array $body): array
    {
        $email = self::normalizeEmail($body['email'] ?? '');
        $password = (string) ($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? ''));
        if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $email)) self::fail(400, 'Enter a valid email address');
        if (strlen($password) < 8) self::fail(400, 'Password must be at least 8 characters');
        if (self::findUser($email)) self::fail(409, 'An account with that email already exists');
        $user = Store::create('User', [
            'email' => $email,
            'full_name' => $fullName !== '' ? $fullName : explode('@', $email)[0],
            'role' => 'user',
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ]);
        return self::publicUser($user);
    }

    public static function authenticate(array $body): array
    {
        $user = self::findUser(self::normalizeEmail($body['email'] ?? ''));
        $hash = $user['password_hash'] ?? '';
        if (self::isLegacyHash($hash)) {
            self::fail(403, 'This account needs a password reset — use “Forgot password” to set a new one');
        }
        if (!$user || !is_string($hash) || !password_verify((string) ($body['password'] ?? ''), $hash)) {
            self::fail(401, 'Invalid email or password');
        }
        return self::publicUser($user);
    }

    public static function setPassword(string $userId, string $password): void
    {
        if (strlen($password) < 8) self::fail(400, 'Password must be at least 8 characters');
        Store::update('User', $userId, ['password_hash' => password_hash($password, PASSWORD_BCRYPT)]);
    }

    public static function createResetToken(mixed $email): ?string
    {
        $user = self::findUser(self::normalizeEmail($email));
        if (!$user) return null;
        $token = bin2hex(random_bytes(24));
        Store::create('PasswordReset', [
            'token' => $token,
            'user_id' => $user['id'],
            'email' => $user['email'],
            'expires_at' => gmdate('Y-m-d\TH:i:s.v\Z', time() + self::RESET_MINUTES * 60),
        ]);
        return $token;
    }

    public static function consumeResetToken(mixed $token, mixed $password): array
    {
        $rows = Store::filter('PasswordReset', ['token' => (string) $token]);
        $row = $rows[0] ?? null;
        if (!$row || strtotime((string) $row['expires_at']) <= time()) {
            self::fail(400, 'That reset link is invalid or has expired');
        }
        self::setPassword((string) $row['user_id'], (string) $password);
        Store::delete('PasswordReset', (string) $row['id']);
        $user = self::findUser((string) $row['email']);
        return self::publicUser($user);
    }

    // Google sign-in (OAuth 2.0): match by email or create the account.
    public static function upsertOAuthUser(array $profile): array
    {
        $email = self::normalizeEmail($profile['email'] ?? '');
        if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $email)) {
            self::fail(400, 'The provider did not return a usable email');
        }
        $existing = self::findUser($email);
        if ($existing) {
            if (!empty($profile['avatar_url']) && empty($existing['avatar_url'])) {
                $existing = Store::update('User', (string) $existing['id'], ['avatar_url' => $profile['avatar_url']]);
            }
            return self::publicUser($existing);
        }
        $user = Store::create('User', [
            'email' => $email,
            'full_name' => trim((string) ($profile['full_name'] ?? '')) ?: explode('@', $email)[0],
            'role' => 'user',
            'auth_provider' => 'google',
            'avatar_url' => (string) ($profile['avatar_url'] ?? ''),
            'password_hash' => '',
        ]);
        return self::publicUser($user);
    }

    private function __construct() {}
}
