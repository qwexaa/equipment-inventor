# Учет и инвентаризация оборудования

Простое и удобное веб‑приложение для учета оборудования: инвентаризация, история перемещений, импорт/экспорт, поиск и фильтры. Подходит для ИТ‑отделов и хозслужбы.

## Возможности
- Аутентификация и роли: ADMIN, EDITOR, VIEWER, USER
- Инвентарь: карточки оборудования, статусы, поиск/сортировка/фильтры
- Склад: позиции со складскими остатками, перенос в инвент и возврат на склад
- Импорт/экспорт: CSV/XLSX
- История перемещений: кто, когда и что перенес/вернул
- Удобный интерфейс: быстрый поиск, массовые действия

## Скриншоты
- ![Главный список](docs/screenshots/1-list.png)
- ![Карточка оборудования](docs/screenshots/2-detail.png)
- ![Склад](docs/screenshots/3-warehouse.png)

Структуру `docs/screenshots/` можно менять по вашему вкусу.

## Технологии
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, Multer, Zod
- Frontend: React, Vite, TypeScript, TailwindCSS

## Требования
- Node 18+
- Docker (для PostgreSQL через docker-compose)

## Быстрый старт в Docker
```bash
# 1) Запустить базу
docker compose up -d postgres

# 2) Собрать и запустить backend и frontend
docker compose up -d --build backend frontend
```
По умолчанию:
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

## Локальный запуск (ручной, без Docker)
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
Backend будет на http://localhost:4000.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend будет на http://localhost:5173.

## Переменные окружения (backend/.env)
```
DATABASE_URL="postgresql://app:app@localhost:5432/inventory?schema=public"
JWT_SECRET="supersecret"
PORT=4000
CORS_ORIGIN=http://localhost:5173
UPLOAD_DIR=./tmp
```


## Роли и доступ
- Первый пользователь регистрируется через `/api/auth/register` (в UI есть кнопка «Регистрация» при первом запуске).
- Роль ADMIN может управлять пользователями и выполнять служебные действия.

## Импорт/Экспорт
- Поддерживается импорт CSV/XLSX (раздел «Импорт»).
- Дедупликация по `serialNumber` или `inventoryNumber`.

## Демо‑данные (опционально)
Чтобы добавить пример данных (30 записей в инвентаре и 20 на складе), вызовите эндпоинт (нужен ADMIN‑токен):
```bash
curl -X POST http://localhost:4000/api/admin/demo/seed \
  -H "Authorization: Bearer <ВАШ_JWT>"
```
После этого обновите страницы «Оборудование» и «Склад».

## Структура проекта
- `backend/` — сервер, Prisma‑схема, маршруты API
- `frontend/` — клиент (React + Vite), страницы и компоненты
- `docker-compose.yml` — сервисы (PostgreSQL, backend, frontend)
- `docs/screenshots/` — скриншоты для README

## Сборка и прод‑развертывание
- Фронтенд: Vite build + Nginx (multi‑stage Docker)
- Бэкенд: Node 18, Prisma миграции
- Рекомендуется включить CORS/Helmet/Rate Limit для production

## Поддержка
Нашли ошибку или есть предложения — создайте Issue или Pull Request.
