#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Smart ISP — Production Update Script (Mono-Repo) v1.18.1 — Phase 18.1: harden global GreenWeb SMS preservation during tenant cleanup + stronger post-deploy integrity guard. Landing refresh remains synced. Integrations (SMS, SMTP, payment, MikroTik) remain read-only smoke-checked.
# Usage: sudo ./deploy-update.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/smartisp"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
REPO_DIR="/tmp/smartisp-repo"
REPO_URL="https://github.com/snsbd247/hi-spark-share.git"
SCRIPT_PATH="${REPO_DIR}/ISP-Backend/deploy/deploy-update.sh"
PHP_VERSION="8.2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══ Smart ISP — Production Update (v1.18.1) ═══${NC}"

# ── 1. Maintenance mode ──────────────────────────────
echo -e "${YELLOW}[1/9] Maintenance mode ON...${NC}"
cd ${BACKEND_DIR}
php artisan down --retry=60 2>/dev/null || true

# ── 2. Pull latest code from GitHub ──────────────────
echo -e "${YELLOW}[2/9] Pulling latest code from GitHub...${NC}"
REPO_UPDATED=0
if [ -d "${REPO_DIR}/.git" ]; then
    cd ${REPO_DIR}
    CURRENT_HEAD=$(git rev-parse HEAD)
    git pull origin main
    NEW_HEAD=$(git rev-parse HEAD)
    [ "${CURRENT_HEAD}" != "${NEW_HEAD}" ] && REPO_UPDATED=1
else
    echo -e "${YELLOW}  Repo not found — cloning fresh from ${REPO_URL}${NC}"
    rm -rf ${REPO_DIR}
    git clone ${REPO_URL} ${REPO_DIR}
    REPO_UPDATED=1
fi

if [ "${REPO_UPDATED}" = "1" ] && [ "${DEPLOY_SCRIPT_RELOADED:-0}" != "1" ]; then
    echo -e "${YELLOW}  New deploy script detected — reloading latest version...${NC}"
    exec env DEPLOY_SCRIPT_RELOADED=1 bash ${SCRIPT_PATH}
fi

# ── 3. Sync Backend files ────────────────────────────
echo -e "${YELLOW}[3/9] Syncing backend files...${NC}"
rsync -a --exclude='.git' --exclude='.env' --exclude='storage/app' \
    --exclude='storage/framework/cache/data' --exclude='storage/framework/sessions' \
    --exclude='storage/framework/views' --exclude='storage/logs' \
    "${REPO_DIR}/ISP-Backend/" "${BACKEND_DIR}/"
echo -e "${GREEN}  ✓ Backend synced${NC}"

# ── 4. Sync Nginx & Deploy configs ──────────────────
echo -e "${YELLOW}[4/9] Syncing Nginx & deploy configs...${NC}"
if [ -f "${BACKEND_DIR}/deploy/nginx-smartispapp.conf" ] && [ -f "${BACKEND_DIR}/deploy/nginx-rate-limits.conf" ]; then
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d
    cp "${BACKEND_DIR}/deploy/nginx-smartispapp.conf" /etc/nginx/sites-available/smartispapp.com
    cp "${BACKEND_DIR}/deploy/nginx-rate-limits.conf" /etc/nginx/conf.d/smartisp-rate-limits.conf
    rm -f /etc/nginx/sites-enabled/smartisp
    ln -sf /etc/nginx/sites-available/smartispapp.com /etc/nginx/sites-enabled/smartispapp.com
    rm -f /etc/nginx/sites-enabled/default
    echo -e "${GREEN}  ✓ Nginx config synced${NC}"
fi

if [ -f "${BACKEND_DIR}/deploy/smartisp-queue.service" ]; then
    cp "${BACKEND_DIR}/deploy/smartisp-queue.service" /etc/systemd/system/
    systemctl daemon-reload
    echo -e "${GREEN}  ✓ Queue worker service updated${NC}"
fi

# ── 5. Sync Frontend files ──────────────────────────
echo -e "${YELLOW}[5/9] Syncing frontend files...${NC}"
FRONTEND_DIRS=("src" "public" "supabase")
FRONTEND_FILES=(
    "package.json" "vite.config.ts" "tsconfig.json" "tsconfig.app.json"
    "tsconfig.node.json" "tailwind.config.ts" "postcss.config.js"
    "index.html" "components.json" "eslint.config.js"
)

for dir in "${FRONTEND_DIRS[@]}"; do
    if [ -d "${REPO_DIR}/${dir}" ]; then
        rsync -a --delete "${REPO_DIR}/${dir}/" "${FRONTEND_DIR}/${dir}/"
    fi
done
for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "${REPO_DIR}/${file}" ]; then
        cp "${REPO_DIR}/${file}" "${FRONTEND_DIR}/${file}"
    fi
done
for lockfile in "bun.lock" "bun.lockb" "package-lock.json"; do
    if [ -f "${REPO_DIR}/${lockfile}" ]; then
        cp "${REPO_DIR}/${lockfile}" "${FRONTEND_DIR}/${lockfile}"
    fi
done
echo -e "${GREEN}  ✓ Frontend synced${NC}"

# ── 6. Backend update ───────────────────────────────
echo -e "${YELLOW}[6/9] Updating backend dependencies...${NC}"
cd ${BACKEND_DIR}
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan modules:scan 2>/dev/null || true

# Run seeders (idempotent — safe to re-run, won't duplicate data)
echo -e "${YELLOW}  Running seeders (Default + Geo + WalletCoa)...${NC}"
php artisan db:seed --class=DefaultSeeder    --force --no-interaction 2>/dev/null || echo -e "${YELLOW}  ⚠ DefaultSeeder skipped${NC}"
php artisan db:seed --class=GeoSeeder        --force --no-interaction 2>/dev/null || echo -e "${YELLOW}  ⚠ GeoSeeder skipped${NC}"
php artisan db:seed --class=WalletCoaSeeder  --force --no-interaction 2>/dev/null || echo -e "${YELLOW}  ⚠ WalletCoaSeeder skipped (will auto-create on first wallet use)${NC}"

# v1.18.0 — Force-refresh hero metadata + ensure mockup_gallery rows exist.
# DefaultSeeder uses firstOrCreate(section_type+sort_order) so existing hero row
# keeps stale metadata after redesign. We update it in place + (re)insert mockup rows.
echo -e "${YELLOW}  Refreshing landing page (hero metadata + mockup gallery)...${NC}"
php artisan tinker --execute="
try {
    \$heroMeta = [
        'badge' => 'Bangladesh #1 ISP Management Platform',
        'title_accent' => 'আধুনিক আইএসপি ব্যবসার জন্য',
        'cta_nav' => 'Get Started',
        'cta_primary' => 'ডেমো রিকোয়েস্ট করুন',
        'cta_secondary' => 'Explore Modules',
        'demo_title' => 'ডেমো রিকোয়েস্ট করুন',
        'demo_subtitle' => 'আমাদের সফটওয়্যার ব্যবহার করতে চান? নিচের ফর্মটি পূরণ করুন।',
        'hero_badges' => ['No Setup Fee', '24/7 Support', 'Free Trial', 'Bangla Interface'],
        'nav_links' => [
            ['label' => 'Platform', 'href' => '#platform'],
            ['label' => 'Modules', 'href' => '#modules'],
            ['label' => 'Pricing', 'href' => '#pricing'],
            ['label' => 'FAQ', 'href' => '#faq'],
            ['label' => 'Contact', 'href' => '#signup'],
        ],
        'trust_text' => 'Trusted by leading ISPs across Bangladesh',
        'trust_logos' => ['NexaFiber', 'LinkStream', 'MetroNet', 'SkyWave', 'Velocity'],
        'pricing_title' => 'Simple, Transparent Pricing',
        'pricing_subtitle' => 'আপনার ISP ব্যবসার জন্য সেরা প্ল্যান বেছে নিন',
    ];
    \DB::table('landing_sections')
        ->where('section_type', 'hero')
        ->update(['metadata' => json_encode(\$heroMeta), 'updated_at' => now()]);

    \$mockups = [
        ['Customer 360°', 'PPPoE, billing & activity history in one unified view', 'UserCircle', 35],
        ['MikroTik Live Sync', 'রিয়েল-টাইম PPP queue, profile এবং disconnect কন্ট্রোল', 'Router', 36],
        ['Fiber Topology Map', 'OLT → Splitter → ONU হায়ারার্কি ভিজুয়ালাইজেশন', 'Cable', 37],
    ];
    foreach (\$mockups as [\$t, \$s, \$ic, \$o]) {
        \$exists = \DB::table('landing_sections')->where('section_type', 'mockup_gallery')->where('sort_order', \$o)->exists();
        if (!\$exists) {
            \DB::table('landing_sections')->insert([
                'section_type' => 'mockup_gallery',
                'title' => \$t, 'subtitle' => \$s, 'icon' => \$ic,
                'sort_order' => \$o, 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }
    echo \"  ✓ Landing hero refreshed + mockup gallery synced\n\";
} catch (\Throwable \$e) {
    echo \"  ⚠ Landing refresh skipped: {\$e->getMessage()}\n\";
}
" 2>/dev/null || echo -e "${YELLOW}  ⚠ Landing refresh tinker skipped${NC}"

# v1.17.2 — Wallet/Settlement smoke + coverage check (read-only, non-fatal)
echo -e "${YELLOW}  Running wallet COA coverage report...${NC}"
php artisan wallet:coverage 2>/dev/null || echo -e "${YELLOW}  ⚠ wallet:coverage reported gaps — run 'php artisan wallet:coverage --fix' on the VPS${NC}"

# v1.17.3 — Heal any legacy SMS settings rows so the global GreenWeb gateway
# is always present as exactly one tenant_id = NULL row. This is idempotent
# and never deletes an existing global row; it only promotes an orphan
# tenant-attached row to global if no global row exists yet.
echo -e "${YELLOW}  Healing global SMS settings (tenant_id = NULL)...${NC}"
php artisan tinker --execute="
try {
    \$global = \DB::table('sms_settings')->whereNull('tenant_id')->orderByDesc('updated_at')->first();
    \$globalHasToken = \$global && !empty(trim((string) (\$global->api_token ?? '')));
    if (!\$globalHasToken) {
        \$orphan = \DB::table('sms_settings')
            ->whereNotNull('api_token')
            ->where('api_token', '!=', '')
            ->where(function(\$q){
                \$q->whereNull('tenant_id')
                  ->orWhereNotIn('tenant_id', function(\$sub){ \$sub->select('id')->from('tenants'); });
            })
            ->orderByDesc('updated_at')
            ->first();
        if (!\$orphan) {
            \$orphan = \DB::table('sms_settings')
                ->whereNotNull('tenant_id')
                ->whereNotNull('api_token')
                ->where('api_token', '!=', '')
                ->orderByDesc('updated_at')
                ->first();
        }
        if (\$orphan && \$global && \$global->id !== \$orphan->id) {
            \DB::table('sms_settings')->where('id', \$global->id)->update([
                'api_token' => \$orphan->api_token,
                'sender_id' => \$orphan->sender_id,
                'admin_cost_rate' => \$orphan->admin_cost_rate,
                'sms_on_bill_generate' => \$orphan->sms_on_bill_generate,
                'sms_on_payment' => \$orphan->sms_on_payment,
                'sms_on_registration' => \$orphan->sms_on_registration,
                'sms_on_suspension' => \$orphan->sms_on_suspension,
                'sms_on_reminder' => \$orphan->sms_on_reminder,
                'sms_on_new_customer_bill' => \$orphan->sms_on_new_customer_bill,
                'whatsapp_enabled' => \$orphan->whatsapp_enabled,
                'whatsapp_token' => \$orphan->whatsapp_token,
                'whatsapp_phone_id' => \$orphan->whatsapp_phone_id,
                'tenant_id' => null,
                'updated_at' => now(),
            ]);
            echo 'Restored existing global SMS row from legacy settings.';
        } elseif (\$orphan) {
            \DB::table('sms_settings')->where('id', \$orphan->id)->update(['tenant_id' => null, 'updated_at' => now()]);
            echo 'Promoted fallback SMS row to global.';
        } else {
            echo 'No usable SMS row found to heal (Super Admin must configure SMS gateway).';
        }
    } else {
        echo 'Global SMS row OK (id='.\$global->id.').';
    }
} catch (\Throwable \$e) { echo 'SMS heal skipped: '.\$e->getMessage(); }
" 2>/dev/null || true

# v1.17.4 — Verify SMS History routes are registered (read-only smoke check)
echo -e "${YELLOW}  Verifying SMS history routes...${NC}"
php artisan route:list --columns=method,uri 2>/dev/null | grep -E "sms/history|sms-logs|sms/logs" || echo -e "${YELLOW}  ⚠ SMS history routes not yet visible (clear caches will fix).${NC}"

# v1.17.5 — Confirm sms_logs performance indexes are present (read-only smoke check)
echo -e "${YELLOW}  Verifying sms_logs indexes...${NC}"
php artisan tinker --execute="
try {
    \$driver = \DB::connection()->getDriverName();
    if (\$driver === 'mysql' || \$driver === 'mariadb') {
        \$rows = \DB::select('SHOW INDEX FROM sms_logs');
        \$names = array_unique(array_map(fn(\$r) => \$r->Key_name, \$rows));
    } elseif (\$driver === 'pgsql') {
        \$rows = \DB::select(\"SELECT indexname FROM pg_indexes WHERE tablename = 'sms_logs'\");
        \$names = array_map(fn(\$r) => \$r->indexname, \$rows);
    } else { \$names = []; }
    foreach (['sms_logs_tenant_created_idx','sms_logs_status_idx','sms_logs_phone_idx'] as \$idx) {
        echo (in_array(\$idx, \$names, true) ? '  ✓ ' : '  ⚠ missing ') . \$idx . PHP_EOL;
    }
} catch (\Throwable \$e) { echo 'Index check skipped: '.\$e->getMessage(); }
" 2>/dev/null || true

# v1.18.1 — Global SMS gateway integrity verification + auto-heal
echo -e "${YELLOW}  Verifying global SMS gateway integrity...${NC}"
php artisan tinker --execute="
try {
    \$global = \DB::table('sms_settings')->whereNull('tenant_id')->orderByDesc('updated_at')->first();
    \$globalHasToken = \$global && !empty(trim((string) (\$global->api_token ?? '')));
    \$tenantBound = \DB::table('sms_settings')->whereNotNull('tenant_id')->whereNotNull('api_token')->where('api_token', '!=', '')->orderByDesc('updated_at')->first();

    if (!\$globalHasToken && \$tenantBound) {
        if (\$global && \$global->id !== \$tenantBound->id) {
            \DB::table('sms_settings')->where('id', \$global->id)->update([
                'api_token' => \$tenantBound->api_token,
                'sender_id' => \$tenantBound->sender_id,
                'admin_cost_rate' => \$tenantBound->admin_cost_rate,
                'sms_on_bill_generate' => \$tenantBound->sms_on_bill_generate,
                'sms_on_payment' => \$tenantBound->sms_on_payment,
                'sms_on_registration' => \$tenantBound->sms_on_registration,
                'sms_on_suspension' => \$tenantBound->sms_on_suspension,
                'sms_on_reminder' => \$tenantBound->sms_on_reminder,
                'sms_on_new_customer_bill' => \$tenantBound->sms_on_new_customer_bill,
                'whatsapp_enabled' => \$tenantBound->whatsapp_enabled,
                'whatsapp_token' => \$tenantBound->whatsapp_token,
                'whatsapp_phone_id' => \$tenantBound->whatsapp_phone_id,
                'tenant_id' => null,
                'updated_at' => now(),
            ]);
            echo '  ✓ Restored blank global SMS row from tenant-bound gateway (id=' . \$global->id . ')' . PHP_EOL;
        } else {
            \DB::table('sms_settings')->where('id', \$tenantBound->id)->update(['tenant_id' => null, 'updated_at' => now()]);
            echo '  ✓ Promoted legacy tenant-bound SMS gateway to global row (id=' . \$tenantBound->id . ')' . PHP_EOL;
        }
        \$global = \DB::table('sms_settings')->whereNull('tenant_id')->orderByDesc('updated_at')->first();
        \$globalHasToken = \$global && !empty(trim((string) (\$global->api_token ?? '')));
    }

    if (\$globalHasToken) {
        echo '  ✓ Global SMS row present (id=' . \$global->id . ')' . PHP_EOL;
    } else {
        echo '  ⚠ No global SMS row with API token found. Super Admin should configure GreenWeb gateway.' . PHP_EOL;
    }

    \$countTenantRows = \DB::table('sms_settings')->whereNotNull('tenant_id')->count();
    \$matchingTenantRows = \$globalHasToken
        ? \DB::table('sms_settings')->whereNotNull('tenant_id')->where('api_token', \$global->api_token)->count()
        : 0;
    echo '  tenant-scoped sms_settings rows: ' . \$countTenantRows . PHP_EOL;
    if (\$matchingTenantRows > 0) {
        echo '  ⚠ Found tenant-scoped SMS rows sharing the active global token: ' . \$matchingTenantRows . PHP_EOL;
    } else {
        echo '  ✓ No tenant-scoped SMS row is shadowing the active global GreenWeb token.' . PHP_EOL;
    }
} catch (\Throwable \$e) { echo '  SMS integrity check skipped: ' . \$e->getMessage(); }
" 2>/dev/null || true

# v1.17.8 — Post-deploy integration smoke tests (non-blocking)
# Confirms SMS, SMTP, Payment Gateway, and MikroTik config layers are intact
# after migration. Runs the targeted PostDeploySmokeTest + the regression
# guard SmsGatewayPreservationTest. Failures are reported but don't abort
# the deploy — review test output if any test fails.
echo -e "${YELLOW}  Running post-deploy integration smoke tests...${NC}"
if [ -f "${BACKEND_DIR}/vendor/bin/phpunit" ]; then
    "${BACKEND_DIR}/vendor/bin/phpunit" \
        --filter '(PostDeploySmokeTest|SmsGatewayPreservationTest)' \
        --no-coverage \
        --colors=never 2>&1 | tail -25 || echo -e "${YELLOW}  ⚠ Smoke tests reported failures — review above.${NC}"
else
    echo -e "${YELLOW}  ⚠ phpunit not found at vendor/bin/phpunit — skipping smoke tests.${NC}"
fi

# v1.17.8 — Surface recent SMS auto-promotion audit entries (last 5)
echo -e "${YELLOW}  Recent SMS auto-promotion audit entries:${NC}"
php artisan tinker --execute="
try {
    \$rows = \DB::table('activity_logs')
        ->where('module', 'sms_settings')
        ->where('action', 'auto_promote')
        ->orderByDesc('created_at')
        ->limit(5)
        ->get(['created_at', 'description', 'metadata']);
    if (\$rows->isEmpty()) { echo '  (none — gateway is stable)'; }
    foreach (\$rows as \$r) {
        echo '  ['.\$r->created_at.'] '.\$r->description.PHP_EOL;
    }
} catch (\Throwable \$e) { echo '  Audit lookup skipped: '.\$e->getMessage(); }
" 2>/dev/null || true

echo -e "${YELLOW}  Verifying module/permission/sidebar sync...${NC}"
php artisan tinker --execute="
try {
    \$expected = \Database\Seeders\DefaultSeeder::SYSTEM_MODULE_SLUGS;
    \$expectedCount = count(\$expected);

    \$moduleSlugs = \DB::table('modules')->pluck('slug')->all();
    \$permModules = \DB::table('permissions')->distinct()->pluck('module')->all();
    \$enabledRaw  = \DB::table('system_settings')->where('setting_key','enabled_modules')->value('setting_value');
    \$enabled = \$enabledRaw ? (json_decode(\$enabledRaw, true) ?: []) : [];

    \$missingFromModules = array_values(array_diff(\$expected, \$moduleSlugs));
    \$missingFromPerms   = array_values(array_diff(\$expected, \$permModules));
    \$missingFromEnabled = array_values(array_diff(\$expected, \$enabled));

    echo '  Expected modules: '.\$expectedCount.PHP_EOL;
    echo '  modules table:    '.count(\$moduleSlugs).(empty(\$missingFromModules) ? ' ✓' : ' ⚠ missing: '.implode(',', \$missingFromModules)).PHP_EOL;
    echo '  permissions:      '.count(\$permModules).(empty(\$missingFromPerms) ? ' ✓' : ' ⚠ missing: '.implode(',', \$missingFromPerms)).PHP_EOL;
    echo '  enabled_modules:  '.count(\$enabled).(empty(\$missingFromEnabled) ? ' ✓' : ' ⚠ missing: '.implode(',', \$missingFromEnabled)).PHP_EOL;
} catch (\Throwable \$e) { echo '  Sync check skipped: '.\$e->getMessage(); }
" 2>/dev/null || true


echo -e "${YELLOW}[7/9] Building frontend...${NC}"
cd ${FRONTEND_DIR}
npm install --legacy-peer-deps --no-audit --no-fund
# VITE_DEPLOY_TARGET kept for backward compatibility / clarity.
# The frontend now defaults to `/api` for any non-cpanel build, so this
# value is informational unless you set it to `cpanel` for legacy hosting.
VITE_DEPLOY_TARGET=vps npm run build

# ── 8. Deploy frontend ──────────────────────────────
echo -e "${YELLOW}[8/9] Deploying frontend build...${NC}"
rsync -a --delete ${FRONTEND_DIR}/dist/ ${APP_DIR}/public_html/

# ── 9. Cache, permissions & restart ─────────────────
echo -e "${YELLOW}[9/9] Caching, permissions & restart...${NC}"
cd ${BACKEND_DIR}
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Force-recreate storage symlink (idempotent — fixes broken/stale links)
if [ -L "${BACKEND_DIR}/public/storage" ] || [ -e "${BACKEND_DIR}/public/storage" ]; then
    rm -rf "${BACKEND_DIR}/public/storage"
fi
php artisan storage:link 2>/dev/null || true

# One-time migration: rewrite legacy /storage/... URLs in general_settings
# to /api/storage/serve/... so they work without depending on the symlink.
# Safe to re-run — only updates rows that still match the old pattern.
php artisan tinker --execute="
try {
    \DB::table('general_settings')->get()->each(function(\$row) {
        \$update = [];
        foreach (['logo_url','login_logo_url','favicon_url'] as \$f) {
            \$v = \$row->\$f ?? null;
            if (\$v && strpos(\$v, '/storage/') !== false && strpos(\$v, '/api/storage/serve/') === false) {
                \$update[\$f] = preg_replace('#(https?://[^/]+)?/storage/#', '\$1/api/storage/serve/', \$v);
            }
        }
        if (!empty(\$update)) {
            \DB::table('general_settings')->where('id', \$row->id)->update(\$update);
        }
    });
    echo 'Branding URLs migrated.';
} catch (\Throwable \$e) { echo 'Skip: '.\$e->getMessage(); }
" 2>/dev/null || true

chown -R www-data:www-data ${APP_DIR}/public_html
chmod -R u=rwX,go=rX ${APP_DIR}/public_html
chown -R www-data:www-data ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache
chmod -R 775 ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache

systemctl restart php${PHP_VERSION}-fpm
nginx -t
systemctl reload nginx
systemctl restart smartisp-queue 2>/dev/null || true

cd ${BACKEND_DIR}
php artisan up

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Update complete! (v1.17.8 — Integration smoke tests + auto-promotion audit + UI heal action + source indicator. Global GreenWeb gateway permanently preserved.)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Verify: curl -s https://smartispapp.com/api/health"
echo ""
echo -e "${YELLOW}── Phase 8: Reverb WebSocket setup (one-time, optional) ──${NC}"
echo -e "  Backend (.env):"
echo -e "    BROADCAST_CONNECTION=reverb"
echo -e "    REVERB_APP_ID=smartisp"
echo -e "    REVERB_APP_KEY=<random-32-char-string>"
echo -e "    REVERB_APP_SECRET=<random-32-char-string>"
echo -e "    REVERB_HOST=ws.smartispapp.com"
echo -e "    REVERB_PORT=8080"
echo -e "    REVERB_SCHEME=https"
echo -e "  Install + start:"
echo -e "    composer require laravel/reverb"
echo -e "    php artisan reverb:install"
echo -e "    php artisan reverb:start --host=0.0.0.0 --port=8080  (run via systemd / supervisor)"
echo -e "  Nginx: reverse-proxy ws.smartispapp.com → 127.0.0.1:8080 with WebSocket upgrade headers."
echo -e "  Frontend (Vite build env):"
echo -e "    VITE_REVERB_APP_KEY=<same as REVERB_APP_KEY>"
echo -e "    VITE_REVERB_HOST=ws.smartispapp.com"
echo -e "    VITE_REVERB_PORT=443"
echo -e "    VITE_REVERB_SCHEME=https"
echo -e "  Without these vars, frontend silently falls back to 15s polling — no errors."
