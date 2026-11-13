<?php
// The PHP ports of src/routes/api/uploads.js and files.$name.js.
declare(strict_types=1);

final class UploadRoutes
{
    private const MAX_BYTES = 8 * 1024 * 1024;
    private const EXTENSION = '/\.([a-z0-9]{1,8})$/i';
    private const ALLOWED = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'];
    private const BY_TYPE = [
        'image/png' => '.png',
        'image/jpeg' => '.jpg',
        'image/webp' => '.webp',
        'image/gif' => '.gif',
        'application/pdf' => '.pdf',
    ];
    private const TYPES = [
        '.png' => 'image/png',
        '.jpg' => 'image/jpeg',
        '.jpeg' => 'image/jpeg',
        '.webp' => 'image/webp',
        '.gif' => 'image/gif',
        '.svg' => 'image/svg+xml',
        '.pdf' => 'application/pdf',
        '.txt' => 'text/plain; charset=utf-8',
    ];

    public static function upload(): void
    {
        $user = Auth::sessionUser();
        if (!$user) {
            Http::json(['error' => 'Unauthorized'], 401);
            return;
        }
        try {
            $file = $_FILES['file'] ?? null;
            if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                Http::json(['error' => 'Choose a file to upload'], 400);
                return;
            }
            if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
                throw new RuntimeException('That upload failed — try again', 400);
            }
            if (($file['size'] ?? 0) > self::MAX_BYTES) {
                Http::json(['error' => 'That file is over 8 MB — pick a smaller one'], 413);
                return;
            }
            $extension = self::safeExtension((string) $file['name'], (string) ($file['type'] ?? ''));
            $dir = (string) Config::get('uploadDir');
            if (!is_dir($dir)) mkdir($dir, 0750, true);
            $name = bin2hex(random_bytes(16)) . $extension;
            if (!move_uploaded_file((string) $file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $name)) {
                throw new RuntimeException('Could not store the upload', 500);
            }
            $url = "/api/files/{$name}";
            Http::json([
                'file_url' => $url,
                'file_uri' => $url,
                'name' => $name,
                'size' => (int) $file['size'],
                'type' => (string) ($file['type'] ?? ''),
            ]);
        } catch (Throwable $error) {
            Http::failure($error);
        }
    }

    public static function file(string $name): void
    {
        if (!preg_match('/^[A-Za-z0-9._-]+$/', $name) || str_contains($name, '..')) {
            Http::json(['error' => 'Not found'], 404);
            return;
        }
        $path = (string) Config::get('uploadDir') . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) {
            Http::json(['error' => 'Not found'], 404);
            return;
        }
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        Http::file($path, self::TYPES[$extension] ?? 'application/octet-stream', 'public, max-age=31536000, immutable');
    }

    private static function safeExtension(string $name, string $type): string
    {
        if (preg_match(self::EXTENSION, $name, $match) && in_array(strtolower($match[1]), self::ALLOWED, true)) {
            return '.' . strtolower($match[1]);
        }
        if (isset(self::BY_TYPE[$type])) return self::BY_TYPE[$type];
        throw new RuntimeException('Only images and PDF documents can be uploaded', 400);
    }

    private function __construct() {}
}
