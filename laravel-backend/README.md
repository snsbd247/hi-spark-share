# Smart ISP — Laravel Backend

Complete Laravel 11 API backend for the ISP Billing System.

## Complete Folder Structure

```
laravel-backend/
├── app/
│   ├── Console/Commands/          # Artisan commands (AutoSuspend, GenerateBills, CleanupSessions)
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/               # All 12 API controllers
│   │   ├── Middleware/             # AdminAuth, CustomerAuth, CheckPermission
│   │   └── Requests/              # 18 Form Request validation classes
│   ├── Models/                    # 29+ Eloquent models (all UUID-based)
│   ├── Providers/                 # AppServiceProvider
│   ├── Services/                  # 7 Business logic services
│   └── Traits/                    # HasUuid trait
├── bootstrap/
│   ├── app.php                    # Application bootstrap + middleware config
│   └── providers.php              # Service providers
├── config/
│   ├── app.php                    # Application config
│   ├── auth.php                   # Authentication guards
│   ├── cache.php                  # Cache stores
│   ├── cors.php                   # CORS settings
│   ├── database.php               # MySQL connection
│   ├── filesystems.php            # Storage disks
│   ├── logging.php                # Log channels
│   ├── mail.php                   # SMTP config
│   ├── queue.php                  # Queue connections
│   ├── sanctum.php                # Sanctum stateful domains
│   ├── services.php               # bKash, Nagad, GreenWeb
│   └── session.php                # Session config
├── database/
│   ├── factories/
│   ├── migrations/                # 29+ MySQL migrations + Laravel defaults
│   └── seeders/                   # DefaultSeeder + DatabaseSeeder
├── public/
│   ├── .htaccess                  # Apache rewrite rules
│   └── index.php                  # Application entry point
├── routes/
│   ├── api.php                    # All API routes
│   └── console.php                # Scheduled tasks
├── storage/                       # Logs, cache, sessions, uploads
├── tests/                         # PHPUnit test structure
├── .env.example                   # Environment template
├── artisan                        # CLI entry point
├── composer.json                  # PHP dependencies
└── phpunit.xml                    # Test configuration
```

## Quick Setup

### 1. Prerequisites
- PHP 8.2+ (with extensions: pdo_mysql, mbstring, openssl, json, curl, sockets)
- Composer 2.x
- MySQL 8.0+ (or XAMPP/Laragon/MAMP)
- Node.js 18+ (for the React frontend)

### 2. Install Dependencies

```bash
cd laravel-backend
composer install
```

### 3. Environment Setup

```bash
cp .env.example .env
php artisan key:generate
```

### 4. Create Database

```bash
mysql -u root -e "CREATE DATABASE isp_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Edit `.env` with your MySQL credentials:
```
DB_DATABASE=isp_management
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 5. Run Migrations & Seed

```bash
php artisan migrate
php artisan db:seed
```

This creates two admin accounts:
- **admin@smartisp.com** / `admin123`
- **ismail** / `Admin@123`

### 6. Create Storage Symlink

```bash
php artisan storage:link
```

### 7. Start the Server

```bash
php artisan serve
# API runs at http://localhost:8000/api
```

## Scheduler (Cron)

Add to your system crontab for automated tasks:
```
* * * * * cd /path/to/laravel-backend && php artisan schedule:run >> /dev/null 2>&1
```

Scheduled tasks:
- `bills:generate` — 1st of every month
- `customers:auto-suspend` — Daily at 2 AM
- `sessions:cleanup` — Every hour

## API Endpoints Summary

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/portal/login` | Customer portal login |
| ANY | `/api/bkash/callback` | bKash payment callback |
| ANY | `/api/nagad/callback` | Nagad payment callback |

### Admin Protected (requires `X-Session-Token` header)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/logout` | Admin logout |
| GET | `/api/admin/me` | Current admin info |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| POST | `/api/bills/generate` | Generate monthly bills |
| POST | `/api/payments` | Record payment |
| POST | `/api/sms/send` | Send SMS |
| POST | `/api/sms/send-bulk` | Bulk SMS |
| POST | `/api/email/send` | Send email |
| POST | `/api/mikrotik/sync` | Sync customer to router |
| POST | `/api/mikrotik/bill-control` | Bill-based PPPoE control |
| GET | `/api/mikrotik/router-stats/{id}` | Router resource stats |
| POST | `/api/storage/upload` | Upload file |
| GET | `/api/storage/list` | List files |
| GET/POST/PUT/DELETE | `/api/{table}` | Generic CRUD |

### Customer Portal (requires `X-Session-Token` header)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portal/dashboard` | Customer dashboard |
| GET | `/api/portal/bills` | Customer bills |
| GET | `/api/portal/payments` | Payment history |
| GET/POST | `/api/portal/tickets` | Support tickets |

## cPanel Deployment

1. Upload `laravel-backend/` to your server
2. Point domain/subdomain document root to `public/`
3. Update `.env` with production database credentials
4. Run `composer install --optimize-autoloader --no-dev`
5. Run `php artisan migrate --seed`
6. Run `php artisan config:cache && php artisan route:cache`
7. Set up cron job for the scheduler

## Architecture Notes

- **Laravel 11** — No `Kernel.php` files; middleware configured in `bootstrap/app.php`
- **UUID Primary Keys** — All models use `HasUuid` trait for MySQL compatibility
- **No Supabase** — 100% Laravel-native backend
- **Session-Based Auth** — Custom token-based sessions (not Laravel Sanctum tokens), stored in `admin_sessions` / `customer_sessions` tables
- **Generic CRUD** — `GenericCrudController` handles dynamic table operations via `$tableModelMap`
