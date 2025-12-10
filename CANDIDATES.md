# Управление кандидатами

## Как добавить кандидатов в номинации

Есть несколько способов добавить кандидатов:

### Способ 1: Через API (для админов)

Используйте API endpoint для создания кандидатов:

```bash
POST /api/candidates
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "nomination_id": 1,
  "name": "Имя кандидата",
  "description": "Описание (необязательно)"
}
```

### Способ 2: Через SQLite напрямую

1. Откройте базу данных:
```bash
sqlite3 database/premia.db
```

2. Посмотрите список номинаций:
```sql
SELECT id, name FROM nominations;
```

3. Добавьте кандидатов:
```sql
INSERT INTO candidates (nomination_id, name, video_url) 
VALUES (1, 'Имя кандидата', 'https://www.youtube.com/watch?v=VIDEO_ID');
```

4. Пример для нескольких кандидатов:
```sql
-- Для номинации "Клип года" (id=1) с видео
INSERT INTO candidates (nomination_id, name, video_url) VALUES 
(1, 'Клип 1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
(1, 'Клип 2', 'https://vimeo.com/123456789'),
(1, 'Клип 3', NULL);

-- Для номинации без видео
INSERT INTO candidates (nomination_id, name) VALUES 
(2, 'Иван'),
(2, 'Мария');
```

**Поддерживаемые форматы видео:**
- **YouTube**: `https://www.youtube.com/watch?v=VIDEO_ID` или `https://youtu.be/VIDEO_ID`
- **Vimeo**: `https://vimeo.com/VIDEO_ID`
- **Twitch (видео)**: `https://www.twitch.tv/videos/VIDEO_ID`
- **Twitch (клипы)**: `https://www.twitch.tv/USERNAME/clip/CLIP_ID` или `https://clips.twitch.tv/CLIP_ID`
- **Прямые ссылки на видео файлы**: `.mp4`, `.webm`, `.ogg`, `.mov`

**Примечание для Twitch:**
- Twitch требует указания родительского домена для безопасности
- Если сайт размещен на домене, убедитесь, что домен добавлен в настройки Twitch
- Для локальной разработки используется `localhost` автоматически

### Способ 3: Через скрипт (можно создать)

Можно создать скрипт `scripts/add-candidates.js` для массового добавления.

## Структура таблицы candidates

```sql
CREATE TABLE candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomination_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id),
    UNIQUE(nomination_id, name)
);
```

## Важные моменты

- Каждый кандидат должен быть привязан к конкретной номинации (`nomination_id`)
- Имя кандидата должно быть уникальным в рамках одной номинации
- После добавления кандидатов они автоматически появятся на карточках номинаций

## Примеры запросов

### Получить всех кандидатов для номинации:
```sql
SELECT * FROM candidates WHERE nomination_id = 1;
```

### Получить всех кандидатов со всеми номинациями:
```sql
SELECT c.*, n.name as nomination_name 
FROM candidates c 
JOIN nominations n ON c.nomination_id = n.id;
```

### Удалить кандидата (только если нет голосов):
```sql
DELETE FROM candidates WHERE id = 1;
```

## API Endpoints

- `GET /api/candidates?nomination_id=1` - Получить кандидатов для номинации
- `POST /api/candidates` - Создать кандидата (только админ)
- `PUT /api/candidates/:id` - Обновить кандидата (только админ)
- `DELETE /api/candidates/:id` - Удалить кандидата (только админ, если нет голосов)

