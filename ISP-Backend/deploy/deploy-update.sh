#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Smart ISP — Production Update Script (Mono-Repo) v1.7.0 — Phase 8: WebSocket live push (Reverb)
# Usage: sudo ./deploy-update.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/smartisp"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
REPO_DIR="/tmp/smartisp-repo"
REPO_URL="https://github.com/snsbd247/hi-spark-share-4de255f8.git"
SCRIPT_PATH="${REPO_DIR}/ISP-Backend/deploy/deploy-update.sh"
PHP_VERSION="8.2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══ Smart ISP — Production Update (v1.7.0) ═══${NC}"

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
echo -e "${YELLOW}  Running seeders (DefaultSeeder + GeoSeeder)...${NC}"
php artisan db:seed --class=DefaultSeeder --force --no-interaction 2>/dev/null || echo -e "${YELLOW}  ⚠ DefaultSeeder skipped${NC}"
php artisan db:seed --class=GeoSeeder --force --no-interaction 2>/dev/null || echo -e "${YELLOW}  ⚠ GeoSeeder skipped${NC}"

# ── 7. Frontend build ───────────────────────────────
echo -e "${YELLOW}[7/9] Building frontend...${NC}"
cd ${FRONTEND_DIR}
npm install --legacy-peer-deps --no-audit --no-fund
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
echo -e "${GREEN}  ✅ Update complete! (v1.3.0 — Live OLT Monitoring Phase 4: Topology Map ONU overlay)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Verify: curl -s https://smartispapp.com/api/health"
