<?php
// Port of src/lib/jwt-fns.js: mints the 15-minute HS256 access token.
declare(strict_types=1);

final class JwtFns
{
    private const ALG = 'HS256';
    private const TTL_SECONDS = 900;
    private const AUDIENCE = 'avora-api';

    public static function registry(): array
    {
        return [
            'jwt/issueAccessToken' => ['auth' => true, 'run' => [self::class, 'issueAccessToken']],
        ];
    }

    public static function issueAccessToken(array $data, ?array $user): array
    {
        $now = time();
        $payload = [
            'sub' => $user['id'] ?? null,
            'email' => Fns::userEmail($user),
            'role' => Fns::str($user['role'] ?? '') ?: 'user',
            'aud' => self::AUDIENCE,
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
        ];

        $head = self::b64url(json_encode(['alg' => self::ALG, 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $body = self::b64url(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $signature = self::b64url(hash_hmac('sha256', $head . '.' . $body, (string) Config::get('secret'), true));

        return [
            'access_token' => $head . '.' . $body . '.' . $signature,
            'token_type' => 'Bearer',
            'expires_in' => self::TTL_SECONDS,
            'expires_at' => gmdate('Y-m-d\TH:i:s.000\Z', $payload['exp']),
        ];
    }

    private static function b64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function __construct() {}
}
