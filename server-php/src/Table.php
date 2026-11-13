<?php
// The PHP equivalent of scoped.server.js / db-client.server.js: personal
// tables force user_email = the signed-in owner on every read and write.
declare(strict_types=1);

final class Table
{
    public const PERSONAL_TABLES = ['Address', 'PaymentMethod', 'Favorite', 'Notification'];

    private function __construct(
        private string $entity,
        private ?string $ownerEmail = null,
    ) {}

    // The table a request may touch: personal tables are owner-scoped.
    public static function for(string $entity, array $user): self
    {
        $personal = in_array($entity, self::PERSONAL_TABLES, true);
        return new self($entity, $personal ? (string) $user['email'] : null);
    }

    public function filter(array $query = [], array $options = []): array
    {
        return Store::filter($this->entity, $this->owned($query), $options);
    }

    public function get(string $id): array
    {
        $row = Store::get($this->entity, $id);
        if ($this->ownerEmail !== null && ($row['user_email'] ?? null) !== $this->ownerEmail) {
            throw new RuntimeException('Not found', 404);
        }
        return $row;
    }

    public function create(array $data = []): array
    {
        if ($this->ownerEmail !== null) $data['user_email'] = $this->ownerEmail;
        return Store::create($this->entity, $data);
    }

    public function update(string $id, array $data): array
    {
        $this->get($id); // ownership check
        return Store::update($this->entity, $id, $data);
    }

    public function delete(string $id): array
    {
        $this->get($id); // ownership check
        return Store::delete($this->entity, $id);
    }

    public function updateMany(array $query, array $data): array
    {
        return Store::updateMany($this->entity, $this->owned($query), $data);
    }

    public function deleteMany(array $query): array
    {
        return Store::deleteMany($this->entity, $this->owned($query));
    }

    private function owned(array $query): array
    {
        if ($this->ownerEmail === null) return $query;
        return array_merge($query, ['user_email' => $this->ownerEmail]);
    }
}
