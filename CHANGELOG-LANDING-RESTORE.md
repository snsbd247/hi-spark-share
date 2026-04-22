# Changelog — Landing Restore vs Preserved Fixes

## Summary
Reverted the landing page to commit `db6aec8c` (the previously approved
design) while keeping all backend hardening, integration fixes, and
seeder updates from intervening commits.

---

## ✅ Restored (frontend only)
- `src/pages/LandingPage.tsx` — reverted to `db6aec8c` design.
  - Original layout, hero, sections, and styling.
- Cache-busting layered on top:
  - `useQuery` keys include `BUILD_VERSION` so a new build always
    invalidates `landing-branding` and `landing-page-sections`.
  - Hash-link normalization (`#platform`, `#modules`, `#signup` →
    canonical anchors) added to keep nav links functional.

## 🔒 Preserved (NOT touched by the restore)
1. **GreenWeb global SMS gateway protection**
   - `app/Http/Controllers/Api/SuperAdminController.php`:
     - `assertGlobalSmsSettingsPreservedAfterTenantDelete()` snapshot +
       post-delete assertion.
   - `tests/Feature/SmsGatewayPreservationTest.php` — regression guard.
2. **Module SSOT (Single Source of Truth)**
   - `Database\Seeders\DefaultSeeder::SYSTEM_MODULE_SLUGS` constant.
   - `modules`, `permissions`, and `system_settings.enabled_modules`
     stay in sync via the deploy script's verification block.
3. **Seeder updates** — `DefaultSeeder` continues to:
   - Seed default SMTP row.
   - Seed payment gateway placeholders (bKash / Nagad / SSLCommerz).
   - Seed global SMS row (idempotent, never deletes existing token).
4. **Deploy script (`deploy/deploy-update.sh`)**
   - SMS heal + integrity verification (v1.17.3, v1.18.1).
   - Module/permission/sidebar sync verification.
   - Wallet COA coverage report.
   - Storage symlink + branding URL migration.

## ➕ New in this iteration
- **Pre-deploy backup + rollback** (deploy-update.sh):
  - SQL dump of integration tables (`sms_settings`, `smtp_settings`,
    `payment_gateways`, `mikrotik_*`) into
    `/var/www/smartisp/backups/pre-deploy-<timestamp>.sql`.
  - On smoke-test failure, operator can run the printed
    `mysql < /var/www/smartisp/backups/pre-deploy-<timestamp>.sql`
    one-liner to restore.
- **Automated post-deploy smoke checks** for SMS, SMTP, Payment, and
  MikroTik via `tests/Feature/PostDeploySmokeTest.php`.
- **CHANGELOG-LANDING-RESTORE.md** (this file).

## 🚫 Explicitly NOT changed
- `EmailService` SMTP resolver
- `SmsService` / GreenWeb client
- bKash / Nagad / SSLCommerz controllers and routes
- `MikrotikService` API client
- Any tenant-scoped business logic
