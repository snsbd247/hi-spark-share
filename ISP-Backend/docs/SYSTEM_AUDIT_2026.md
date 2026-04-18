# Smart ISP — System-Wide Audit (Phase 16.3)

**Date:** 2026-04-18 · **Scope:** Full audit + auto-fix · **Integration policy:** Skip (Email/SMS/Payment/MikroTik untouched)

---

## 1. Sidebar ↔ Routes Sync

### Gaps fixed (added to sidebar)
| Route | Section added | Module |
|---|---|---|
| `/network-map` | Fiber section (after Unlinked ONUs) | `network_map` |
| `/security` | Admin nav | `settings` |
| `/sessions` | Admin nav | `settings` |
| `/activity-logs` | Admin nav | `settings` |
| `/login-history` | Admin nav | `settings` |
| `/settings/general` | Settings nav | `settings` |
| `/settings/footer` | Settings nav | `settings` |

### Intentionally NOT linked (covered by parents / sub-pages)
- `/accounting/products`, `/accounting/sales`, `/accounting/purchases`, `/accounting/reports` — duplicates of inventory/supplier pages.
- `/dashboard`, `/packages` — already top-level entries.
- `/fiber-topology`, `/fiber/*` — already in Fiber section.
- `:id` dynamic routes (profile pages) — opened from list views.

---

## 2. RBAC / Permissions

| Layer | Count | Status |
|---|---|---|
| `permissions` rows (DB live) | 76 (19 modules × 4) | OK |
| Modules in seeder | 21 | DB missing `dashboard`, `live_bandwidth` (auto-seeded on next run) |
| `modules` table rows | 20 | Sync after re-seed |
| Roles seeded | 7 (Super Admin, Admin, Owner, Manager, Staff, Technician, Accountant) | OK |

### Seeder change
Added stale-permission garbage collector in `DefaultSeeder@seedPermissions()` to delete `olts` / `onus` permission rows that may exist from pre-SSOT installs. Integration modules (sms, mikrotik, payments, merchant_payments) explicitly excluded from any cleanup list.

---

## 3. Database Tables — Inventory

**Total tables:** 102 · **Integration tables (untouched):** 14

### Empty + un-referenced (orphan candidates — listed only, NOT dropped)
| Table | Row count | Status | Replacement |
|---|---|---|---|
| `olts` | 0 | Pre-SSOT legacy | `olt_devices` + `fiber_olts` |
| `onus` | 0 | Pre-SSOT legacy | `fiber_onus` + `onu_live_status` |
| `network_nodes` | 0 | Unused (replaced by fiber_* hierarchy) | `fiber_olts` / `fiber_splitters` |
| `network_links` | 0 | Unused (replaced by fiber_cables) | `fiber_cables` |
| `online_sessions` | 0 | Reserved for future PPPoE live tracking | — |
| `attendance` | 0 | HR not in active use yet | — |

> **Action:** Per user policy, none of these are dropped. To drop later, create a migration with `Schema::dropIfExists(...)` and bump `deploy-update.sh` minor version.

### Active integration tables (NOT audited / NOT touched)
`sms_logs`, `sms_settings`, `sms_templates`, `sms_transactions`, `sms_wallets`, `smtp_settings`, `payment_gateways`, `merchant_payments`, `payments`, `mikrotik_routers`, `reminder_logs`, `notifications`, `customer_sessions`, `super_admin_sessions`.

---

## 4. Files modified
- `src/components/layout/AppSidebar.tsx` — added 8 missing nav items
- `ISP-Backend/database/seeders/DefaultSeeder.php` — stale-permission GC
- `ISP-Backend/deploy/deploy-update.sh` — v1.16.3 bump

## 5. Integrations — verified untouched
- ✅ Email (`SmtpSettings`, `EmailService`)
- ✅ SMS (`sms_*` tables, gateway adapters)
- ✅ Payment gateways (bKash, Nagad, SSLCommerz)
- ✅ MikroTik (router sync, profile sync, customer status mapping)
- ✅ OLT polling (Phase 14-16 SSOT pipeline)

---

## 6. Re-run guide

```bash
sudo bash /tmp/smartisp-repo/ISP-Backend/deploy/deploy-update.sh
```

The deploy script auto-runs `DefaultSeeder` (idempotent), which will:
1. Backfill `dashboard` + `live_bandwidth` permissions if missing
2. GC stale `olts` / `onus` permission rows
3. Re-seed role-permission map for all 7 roles
