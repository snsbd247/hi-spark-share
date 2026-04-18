# Fiber/OLT/ONU Module Audit — Phase 16.2

**Date:** 2026-04-18
**Scope (per user request):** Fiber/OLT/ONU module only. Email, SMS, Payment
gateways and MikroTik integrations were **NOT** touched.

---

## ✅ Module / Page Inventory (8 pages, all routed + sidebar-linked)

| # | Frontend page | Route | Backend controller |
|---|---|---|---|
| 1 | `pages/FiberTopology.tsx` | `/fiber-topology` | `FiberTopologyController` |
| 2 | `pages/fiber/OltDevices.tsx` | `/fiber/olt-devices` | `Fiber/OltDeviceController` |
| 3 | `pages/fiber/OnuLiveStatusPage.tsx` | `/fiber/onu-live` | `Fiber/OltDeviceController@liveStatus` |
| 4 | `pages/fiber/OnuAlertRulesPage.tsx` | `/fiber/alerts` | `Fiber/OnuAlertRuleController` |
| 5 | `pages/fiber/OnuAlertLogsPage.tsx` | `/fiber/alert-logs` | `Fiber/OnuAlertRuleController@logs` |
| 6 | `pages/fiber/OnuMikrotikSyncLogsPage.tsx` | `/fiber/mikrotik-sync-logs` | `Fiber/OnuMikrotikSyncLogController` |
| 7 | `pages/fiber/OltPerformancePage.tsx` | `/fiber/olt-performance` | `Fiber/OltPerformanceController` |
| 8 | `pages/fiber/UnlinkedOnus.tsx` | `/fiber/unlinked-onus` | `Fiber/OltDeviceController@unlinkedOnus` |

All 8 are gated by `<PermissionGuard module="fiber_network">` and visible
in sidebar under the **Fiber Topology + Live Monitoring** section (gated
by `isModuleEnabled("fiber_network") && hasModuleAccess("fiber_network")`).

---

## ✅ Database Tables — Active (used by current code)

| Table | Owner model | Purpose |
|---|---|---|
| `fiber_olts` | `FiberOlt` | **SSOT master** — topology OLT entry |
| `fiber_pon_ports` | `FiberPonPort` | PON ports per OLT |
| `fiber_cables` | `FiberCable` | Fiber cables (tenant) |
| `fiber_cores` | `FiberCore` | Cores per cable |
| `fiber_splitters` | `FiberSplitter` | Splitters in topology |
| `fiber_splitter_outputs` | `FiberSplitterOutput` | Splitter output ports |
| `fiber_onus` | `FiberOnu` | **SSOT master** — ONU entry (1 per serial) |
| `olt_devices` | `OltDevice` | OLT credentials/monitoring (1:1 with `fiber_olts`) |
| `olt_polling_logs` | `OltPollingLog` | Per-poll audit trail |
| `onu_live_status` | `OnuLiveStatus` | Real-time signal/status |
| `onu_signal_history` | (raw) | Throttled rx/tx history |
| `onu_alert_rules` | `OnuAlertRule` | Alert thresholds per tenant |
| `onu_alert_logs` | `OnuAlertLog` | Alert event log |
| `onu_mikrotik_sync_logs` | `OnuMikrotikSyncLog` | Auto-suspend/restore audit |
| `core_connections` | (raw) | Topology core-to-port mapping |

---

## ⚠️ Orphan / Legacy Tables (kept by user policy: list only, DO NOT drop)

| Table | Status | Notes |
|---|---|---|
| `olts` | Created by `2024_01_01_000005_create_network_device_tables.php` | **Pre-SSOT legacy.** Replaced by `olt_devices` + `fiber_olts`. Frontend has 0 callers. |
| `onus` | Created by same migration | **Pre-SSOT legacy.** Replaced by `fiber_onus`. Frontend has 0 callers. |

**Action taken (code only, no DB drop):** Removed `'olts'` and `'onus'`
mappings from `GenericCrudController::$tableModelMap` so the dead routes
`/api/olts` and `/api/onus` no longer expose SSOT-violating endpoints.
Tables and models remain intact for backward compatibility / rollback.

**Recommendation (user decision required):** Once you've confirmed no
customer dataset relies on `olts`/`onus` data (they were never wired into
the UI), you can safely drop them in a future migration. Until then the
data is fully preserved.

---

## ✅ RBAC Permission Re-Audit

The system uses **module-level** gating (single `fiber_network` module)
rather than per-page granular permissions. This is intentional and
consistent with the rest of the app's RBAC pattern (Billing, HR, Accounting
all use the same approach).

- **Module slug:** `fiber_network` (`Fiber Network — FTTH topology management`)
- **Defined in:** `database/seeders/DefaultSeeder.php:640`
- **Default-enabled tenants:** every tenant (`enabled_modules` JSON includes it)
- **Roles with full access by default:**
  - `super_admin` (always)
  - `tenant_admin` (always)
  - `tech` role (`techFullModules = ['mikrotik','fiber_network','network_map']`)
- **Frontend gate:** `<PermissionGuard module="fiber_network">` on every route
- **Sidebar gate:** `isModuleEnabled("fiber_network") && hasModuleAccess("fiber_network")`

✅ All 8 pages consistently gated. No orphan or missing permission entries.

---

## ✅ API Endpoint Inventory

**Topology (legacy + SSOT bridge):**
- `GET  /api/fiber-topology/{tree,stats,search,map-data,splices}`
- `POST /api/fiber-topology/{olts,cables,splitters,onus,splices,map-core-to-port}`
- `DELETE /api/fiber-topology/splices/{id}`

**Live Monitoring (Phase 2-16):**
- CRUD: `GET/POST/PUT/DELETE /api/fiber/olt-devices[/{id}]`
- Actions: `POST /api/fiber/olt-devices/{id}/{test,poll}`
- ONU: `GET /api/fiber/onus`, `GET /api/fiber/onus/unlinked`, `POST /api/fiber/onus/{id}/link`
- Status: `GET /api/fiber/onu-live-status`, `GET /api/fiber/onu-signal-history`
- Alerts: `GET/POST/PUT/DELETE /api/fiber/alert-rules[/{id}]`, `GET /api/fiber/alert-logs`
- MikroTik: `GET /api/fiber/mikrotik-sync-logs`
- Performance: `GET /api/fiber/olt-performance[/{id}]`

All routes registered, all controllers exist, all frontend pages call
matching endpoints. No 404 or orphan routes.

---

## 🛡️ Integrations — Untouched (verified)

- **Email** (`EmailService`, SMTP config) — not modified
- **SMS** (`SmsService`, GreenWeb gateway) — not modified
- **Payment** (bKash, Nagad, SSLCommerz) — not modified
- **MikroTik** (`MikrotikService`) — only **read** by `OnuMikrotikAutoSync`,
  which is opt-in (gated by `auto_suspend_pppoe` rule flag, OFF by default).

---

## Summary

| Item | Status |
|---|---|
| Pages | ✅ 8/8 routed + sidebar |
| Permissions | ✅ All gated by `fiber_network` module |
| Active tables | ✅ 15 tables, all referenced |
| Orphan tables | ⚠️ 2 (`olts`, `onus`) — kept per user policy |
| Dead routes | ✅ 2 removed (`/api/olts`, `/api/onus` GenericCrud) |
| Integrations | ✅ Untouched |
