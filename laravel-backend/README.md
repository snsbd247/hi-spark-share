# Smart ISP — Laravel Backend

Complete Laravel 11 API backend for the ISP Billing & ERP System.

## Complete Folder Structure

```
laravel-backend/
├── app/
│   ├── Console/
│   │   ├── Commands/               # 4 Artisan commands
│   │   │   ├── AutoSuspend.php     # Auto-suspend overdue customers
│   │   │   ├── CalculateDailyProfit.php # Daily report generation
│   │   │   ├── CleanupSessions.php # Expire stale sessions
│   │   │   └── GenerateBills.php   # Monthly bill generation
│   │   └── Kernel.php              # Task scheduler
│   ├── Http/
│   │   ├── Controllers/Api/        # 18 API controllers
│   │   │   ├── AccountingController.php       # Chart of Accounts, Transactions, Reports
│   │   │   ├── AccountingHeadController.php   # Income/Expense/Other Heads
│   │   │   ├── AdminUserController.php        # Admin CRUD
│   │   │   ├── AuthController.php             # Login, Logout, Me, Profile
│   │   │   ├── BillController.php             # Bill CRUD + Generate + Cycle Overview
│   │   │   ├── BkashController.php            # bKash Tokenized Checkout
│   │   │   ├── BkashPayBillController.php     # bKash Pay Bill Webhooks
│   │   │   ├── CustomerAuthController.php     # Customer Portal Login
│   │   │   ├── DashboardController.php        # Dashboard Stats
│   │   │   ├── EmailController.php            # SMTP Email
│   │   │   ├── ExpenseController.php          # Expense CRUD + Summary
│   │   │   ├── GenericCrudController.php       # Dynamic table CRUD (40+ tables)
│   │   │   ├── HrController.php               # HR: Employees, Attendance, Loans, Salary
│   │   │   ├── MerchantPaymentController.php  # Merchant Payment Match/Import/Reports
│   │   │   ├── MikrotikBillControlController.php # PPPoE enable/disable, profile sync
│   │   │   ├── MikrotikController.php         # Customer sync, test connection
│   │   │   ├── NagadController.php            # Nagad payment gateway
│   │   │   ├── PaymentController.php          # Payment CRUD + Ledger
│   │   │   ├── PortalController.php           # Customer Portal API
│   │   │   ├── ProductController.php          # Product CRUD + Stock
│   │   │   ├── PurchaseController.php         # Purchase CRUD + Vendor History
│   │   │   ├── ReportController.php           # Reports: Daily, Monthly, BTRC, Financial
│   │   │   ├── SalesController.php            # Sales CRUD + Profit Report
│   │   │   ├── SmsController.php              # GreenWeb SMS
│   │   │   ├── StorageController.php          # File Upload/Download/List
│   │   │   ├── SupplierController2.php        # Supplier CRUD + Payments
│   │   │   └── VendorController.php           # Vendor CRUD
│   │   ├── Middleware/              # 4 Custom middleware
│   │   │   ├── AdminAuth.php       # Session-token auth (Bearer or X-Session-Token)
│   │   │   ├── CheckPermission.php # Module:action RBAC guard
│   │   │   ├── CustomerAuth.php    # Customer portal session auth
│   │   │   └── TenantMiddleware.php# Load ISP branding settings
│   │   └── Requests/               # 18 Form Request validation classes
│   ├── Models/                     # 40+ Eloquent models (all UUID-based)
│   ├── Providers/
│   │   ├── AppServiceProvider.php  # Service bindings
│   │   └── RouteServiceProvider.php
│   ├── Services/                   # 11 Business logic services
│   │   ├── AccountingService.php   # Double-entry ledger, reports (Trial Balance, P&L, etc.)
│   │   ├── BillingService.php      # Monthly bill generation, mark paid
│   │   ├── BkashPayBillService.php # bKash Pay Bill inquiry + payment processing
│   │   ├── BkashService.php        # bKash Tokenized Checkout
│   │   ├── EmailService.php        # SMTP email via Laravel Mail
│   │   ├── InventoryService.php    # Stock increase/decrease/restore
│   │   ├── LedgerService.php       # Customer ledger debit/credit
│   │   ├── MikrotikService.php     # MikroTik RouterOS API (TCP 8728)
│   │   ├── NagadService.php        # Nagad payment gateway
│   │   ├── PurchaseService.php     # Purchase creation + stock + accounting
│   │   ├── SalesService.php        # Sale creation + stock + accounting
│   │   ├── SmsService.php          # GreenWeb SMS API
│   │   └── WhatsappService.php     # WhatsApp Cloud API
│   └── Traits/
│       └── HasUuid.php             # UUID primary key trait
├── bootstrap/
│   ├── app.php                     # Middleware + routing config
│   └── providers.php               # Service providers
├── config/                         # 12 configuration files
├── database/
│   ├── migrations/                 # 42 MySQL migrations
│   └── seeders/                    # DefaultSeeder (admin users, packages, chart of accounts, permissions)
├── public/                         # Entry point + .htaccess
├── routes/
│   ├── api.php                     # All API routes (360+ lines)
│   ├── console.php                 # Scheduled commands
│   └── web.php
├── storage/                        # Logs, cache, uploads
└── tests/                          # PHPUnit structure
```

## Quick Setup

### 1. Prerequisites
- PHP 8.2+ (extensions: pdo_mysql, mbstring, openssl, json, curl, sockets)
- Composer 2.x
- MySQL 8.0+

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

This creates:
- **admin@smartisp.com** / `admin123` (Super Admin)
- **ismail@smartisp.com** / `Admin@123` (Super Admin)
- 4 default ISP packages
- Full Chart of Accounts hierarchy (5 root + children)
- 13 module permissions (view/create/edit/delete)

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

Add to your system crontab:
```
* * * * * cd /path/to/laravel-backend && php artisan schedule:run >> /dev/null 2>&1
```

| Schedule | Command | Description |
|----------|---------|-------------|
| 1st of month, 00:00 | `bills:generate` | Generate monthly bills for active customers |
| Daily at 02:00 | `customers:auto-suspend --days=7` | Suspend customers with 7+ day overdue bills |
| Hourly | `sessions:cleanup` | Expire stale admin sessions, delete expired customer sessions |
| Daily at 23:55 | `reports:daily-profit` | Calculate daily income/expense/profit report |

## API Endpoints Summary

### Public (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login (returns session token) |
| POST | `/api/portal/login` | Customer portal login (PPPoE credentials) |
| ANY | `/api/bkash/callback` | bKash Tokenized Checkout callback |
| ANY | `/api/nagad/callback` | Nagad payment callback |
| POST | `/api/bkash-paybill/inquiry` | bKash Pay Bill — bill inquiry webhook |
| POST | `/api/bkash-paybill/payment` | bKash Pay Bill — payment notification webhook |
| GET | `/api/health` | Health check |

### Admin Protected (requires `Authorization: Bearer <token>` or `X-Session-Token` header)

#### Auth (no permission required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/logout` | Logout |
| GET | `/api/admin/me` | Current admin info + permissions |
| PUT | `/api/admin/profile` | Update profile / password |
| GET | `/api/dashboard/stats` | Full dashboard statistics |

#### Billing (module: billing)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/cycle-overview` | Billing cycle overview by status |
| POST | `/api/bills` | Create single bill |
| POST | `/api/bills/generate` | Generate monthly bills for all customers |
| PUT | `/api/bills/{id}` | Update bill |
| DELETE | `/api/bills/{id}` | Delete bill |

#### Payments (module: payments)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments` | Record payment + ledger entry |
| PUT | `/api/payments/{id}` | Update payment |
| DELETE | `/api/payments/{id}` | Delete payment |

#### Merchant Payments (module: merchant_payments)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchant-payments/reports` | Merchant payment analytics |
| POST | `/api/merchant-payments` | Create merchant payment |
| POST | `/api/merchant-payments/import` | Bulk import |
| POST | `/api/merchant-payments/{id}/match` | Match to customer/bill |

#### Admin Users (module: users)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin-users` | List all admin users |
| POST | `/api/admin-users` | Create admin user |
| PUT | `/api/admin-users/{id}` | Update admin user |
| DELETE | `/api/admin-users/{id}` | Delete admin user |

#### SMS & Email (module: sms)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sms/send` | Send single SMS |
| POST | `/api/sms/send-bulk` | Bulk SMS |
| POST | `/api/email/send` | Send email |

#### MikroTik (module: settings)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mikrotik/sync` | Sync single customer to router |
| POST | `/api/mikrotik/sync-all` | Sync all customers |
| POST | `/api/mikrotik/test-connection` | Test router connection |
| POST | `/api/mikrotik/bill-control` | Enable/disable by bill status |
| POST | `/api/mikrotik/disable-pppoe` | Disable PPPoE secret |
| POST | `/api/mikrotik/enable-pppoe` | Enable PPPoE secret |
| POST | `/api/mikrotik/sync-profile` | Sync package profile to router |
| POST | `/api/mikrotik/remove-profile` | Remove profile from router |
| POST | `/api/mikrotik/bulk-sync-packages` | Sync all package profiles |
| GET | `/api/mikrotik/router-stats/{id}` | Router resource stats |

#### Accounting & Inventory (module: accounting)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounting/chart-of-accounts` | Hierarchical chart |
| GET | `/api/accounting/accounts` | List accounts |
| POST | `/api/accounting/accounts` | Create account |
| PUT | `/api/accounting/accounts/{id}` | Update account |
| DELETE | `/api/accounting/accounts/{id}` | Delete account |
| GET | `/api/accounting/transactions` | List transactions |
| POST | `/api/accounting/transactions` | Create transaction |
| PUT | `/api/accounting/transactions/{id}` | Update transaction |
| DELETE | `/api/accounting/transactions/{id}` | Delete + reverse balance |
| POST | `/api/accounting/journal-entries` | Double-entry journal |
| GET | `/api/accounting/trial-balance` | Trial Balance |
| GET | `/api/accounting/profit-loss` | Profit & Loss |
| GET | `/api/accounting/balance-sheet` | Balance Sheet |
| GET | `/api/accounting/cash-flow` | Cash Flow Statement |
| GET | `/api/accounting/daybook` | Daybook |
| GET | `/api/accounting/ledger-statement` | Ledger with running balance |
| GET | `/api/accounting/receivable-payable` | Receivable/Payable summary |
| GET | `/api/accounting/equity-changes` | Equity Changes |
| GET | `/api/accounting/cheque-register` | Cheque Register |
| GET | `/api/accounting/all-ledgers` | All ledgers list |
| GET/POST/PUT/DELETE | `/api/accounting/income-heads` | Income Heads CRUD |
| GET/POST/PUT/DELETE | `/api/accounting/expense-heads` | Expense Heads CRUD |
| GET/POST/PUT/DELETE | `/api/accounting/other-heads` | Other Heads CRUD |
| CRUD | `/api/vendors` | Vendor management |
| CRUD | `/api/products` | Product management |
| CRUD | `/api/purchases` | Purchase with stock + accounting |
| CRUD | `/api/sales` | Sales with stock + accounting |
| CRUD | `/api/expenses` | Expense management |

#### HR (module: hr)
| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/hr/designations` | Designation management |
| CRUD | `/api/hr/employees` | Employee management |
| GET | `/api/hr/employees/{id}` | Full employee profile |
| GET | `/api/hr/attendance/daily` | Daily attendance |
| GET | `/api/hr/attendance/monthly` | Monthly attendance summary |
| POST | `/api/hr/attendance` | Record attendance |
| POST | `/api/hr/attendance/bulk` | Bulk attendance |
| CRUD | `/api/hr/loans` | Loan management |
| GET | `/api/hr/salary` | Salary sheets |
| POST | `/api/hr/salary/generate` | Generate monthly salary |
| PUT | `/api/hr/salary/{id}` | Update salary sheet |
| POST | `/api/hr/salary/{id}/pay` | Pay salary |

#### Supplier (module: supplier)
| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/suppliers` | Supplier management |
| GET | `/api/supplier-payments` | Supplier payments |
| POST | `/api/supplier-payments` | Create supplier payment |
| DELETE | `/api/supplier-payments/{id}` | Delete supplier payment |
| GET | `/api/supplier-purchases` | Supplier purchases |

#### Reports (module: reports)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Report dashboard |
| GET | `/api/reports/daily` | Daily reports |
| GET | `/api/reports/monthly` | Monthly reports |
| GET | `/api/reports/profit-loss` | P&L report |
| GET | `/api/reports/sales` | Sales report |
| GET | `/api/reports/sales-purchase` | Sales vs Purchase |
| GET | `/api/reports/vendor-dues` | Vendor dues |
| GET | `/api/reports/customer-dues` | Customer dues |
| GET | `/api/reports/stock` | Stock report |
| GET | `/api/reports/expense-breakdown` | Expense breakdown |
| GET | `/api/reports/financial-statement` | Financial statement |
| GET | `/api/reports/btrc` | BTRC compliance report |
| GET | `/api/reports/traffic` | Traffic monitor |

#### Storage (admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/storage/upload` | Upload file (10MB max) |
| GET | `/api/storage/list` | List files in bucket |
| GET | `/api/storage/download` | Download file |
| POST | `/api/storage/delete` | Delete files |
| GET | `/api/storage/serve/{bucket}/{path}` | Serve file |

#### Generic CRUD (catch-all for 40+ tables)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/{table}` | List with filter/search/sort/paginate |
| GET | `/api/{table}/{id}` | Show single record |
| POST | `/api/{table}` | Create record |
| PUT | `/api/{table}/{id}` | Update record |
| DELETE | `/api/{table}/{id}` | Delete record |

### Customer Portal (requires `X-Session-Token` header)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/portal/logout` | Logout |
| GET | `/api/portal/verify` | Verify session |
| GET | `/api/portal/dashboard` | Customer dashboard |
| GET | `/api/portal/bills` | Customer bills |
| GET | `/api/portal/payments` | Payment history |
| GET | `/api/portal/tickets` | Support tickets |
| POST | `/api/portal/tickets` | Create ticket |
| POST | `/api/portal/tickets/{id}/reply` | Reply to ticket |
| GET | `/api/portal/profile` | Customer profile |
| PUT | `/api/portal/profile` | Update profile |

## Architecture Notes

- **Laravel 11** — Middleware configured in `bootstrap/app.php`; Kernel.php used for scheduler only
- **UUID Primary Keys** — All models use `HasUuid` trait for MySQL compatibility
- **Session-Based Auth** — Custom token-based sessions stored in `admin_sessions` / `customer_sessions` tables (not Sanctum tokens)
- **Generic CRUD** — `GenericCrudController` handles 40+ tables via `$tableModelMap`
- **RBAC** — 13 modules × 4 actions, enforced via `CheckPermission` middleware + `CustomRole` → `Permission` mapping
- **Double-Entry Accounting** — Journal entries with automatic account balance updates
- **MikroTik Integration** — Native TCP API (port 8728) for PPPoE management, profile sync, router stats
- **bKash Pay Bill** — Webhook-driven bill inquiry + sequential payment reconciliation
- **11 Service Classes** — All business logic encapsulated in services

## cPanel Deployment

1. Upload `laravel-backend/` to your server
2. Point domain/subdomain document root to `public/`
3. Update `.env` with production database credentials
4. Run `composer install --optimize-autoloader --no-dev`
5. Run `php artisan migrate --seed`
6. Run `php artisan config:cache && php artisan route:cache`
7. Run `php artisan storage:link`
8. Set up cron job for the scheduler
