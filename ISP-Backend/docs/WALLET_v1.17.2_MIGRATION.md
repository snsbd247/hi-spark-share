# Wallet & Settlement v1.17.2 — Migration Guide

**Release:** 2026-04-23
**Migration file:** `database/migrations/2026_04_23_000001_wallet_settlement_audit_addons.php`
**Seeder:** `database/seeders/WalletCoaSeeder.php`
**Coverage command:** `php artisan wallet:coverage [--fix] [--json]`

This release is **purely additive**. No existing columns are renamed or dropped.
Integration modules (MikroTik, SMS, Email, Payment Gateways) are **not touched**.

---

## 1. What changed

### 1.1 `wallet_transactions`
| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `coa_journal_ref` | `VARCHAR(255)` (indexed) | yes | Links a wallet movement to its Chart-of-Accounts journal entry. Backfill is optional — old rows simply remain `NULL`. |

Composite index added: `wallet_txn_filter_idx (tenant_id, type, created_at)` — speeds up
the new Audit Timeline filters (date range + type). Created with try/catch so a
pre-existing index under a different name will not fail the migration.

### 1.2 `employee_settlements`
| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `coa_preview_hash` | `VARCHAR(64)` | yes | SHA-256 of the most recently previewed COA mapping. Used to detect drift between preview and final post. |
| `coa_preview_at`   | `TIMESTAMP`   | yes | When the preview was last generated. |

### 1.3 Seeded accounts (idempotent, per tenant scope)
Seeder uses `firstOrCreate` keyed on `(code, tenant_id)`:

| Code | Name | Type |
|---|---|---|
| 1001 | Cash on hand     | asset |
| 2050 | Wallet Liability | liability |
| 4001 | Bill Revenue     | revenue |
| 5001 | Salary Expense   | expense |
| 2100 | Employee Payable | liability |
| 1300 | Employee Advance | asset |

---

## 2. Deploy steps

```bash
cd /var/www/isp-backend
git pull
php artisan migrate --force
php artisan db:seed --class=Database\\Seeders\\WalletCoaSeeder --force
php artisan wallet:coverage          # verify every tenant has the 6 codes
php artisan cache:clear && php artisan config:clear
```

`deploy-update.sh` (v1.17.2) already chains the above with non-fatal fallbacks.

---

## 3. Verify coverage

```bash
php artisan wallet:coverage           # human-readable table
php artisan wallet:coverage --json    # machine-readable, exit-code aware
php artisan wallet:coverage --fix     # re-run seeder for tenants with gaps
```

Exit code is `0` only when every tenant has all 6 codes.

---

## 4. Rollback (if production data has unexpected formats)

The migration ships a working `down()` that drops only the new columns/index.
Run it **only after** confirming no application code is reading them:

```bash
php artisan migrate:rollback --step=1
```

If you cannot roll back the schema (e.g. partial writes already exist), use the
**forward-safe nullify** instead — it preserves history:

```sql
-- Soft-disable new fields without dropping them
UPDATE wallet_transactions   SET coa_journal_ref = NULL;
UPDATE employee_settlements  SET coa_preview_hash = NULL, coa_preview_at = NULL;
```

The frontend treats `NULL` for these fields as "not previewed" / "no journal
ref", so the UI continues to work unchanged.

---

## 5. Smoke test after deploy

```bash
# 1. Wallet health endpoint
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api.example.com/api/wallet/health | jq .ok

# 2. Wallet timeline loads
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://api.example.com/api/wallet/history?per_page=5" | jq '.data | length'

# 3. Coverage report
php artisan wallet:coverage
```

All three should return success without errors.

---

## 6. Integration safety checklist

This release **must not** disturb the following — verify with a `git diff`:

- [ ] `app/Services/MikrotikService.php` — unchanged
- [ ] `app/Services/SmsService.php` / `GreenwebSmsService.php` — unchanged
- [ ] `app/Services/EmailService.php` — unchanged
- [ ] `app/Http/Controllers/Api/PaymentGatewayController.php` — unchanged
- [ ] `payment_gateways`, `sms_*`, `mikrotik_*`, `email_configs` tables — no schema changes

If any of the above show a diff, **abort the deploy** and review.
