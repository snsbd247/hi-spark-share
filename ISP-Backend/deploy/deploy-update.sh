#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Smart ISP — Production Update Script (Mono-Repo)
# Usage: sudo ./deploy-update.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/smartisp"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
REPO_DIR="/tmp/smartisp-repo"
PHP_VERSION="8.2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══ Smart ISP — Production Update ═══${NC}"

# ── 1. Maintenance mode ──────────────────────────────
echo -e "${YELLOW}[1/8] Maintenance mode ON...${NC}"
cd ${BACKEND_DIR}
php artisan down --retry=60 2>/dev/null || true

# ── 2. Pull latest code from GitHub ──────────────────
echo -e "${YELLOW}[2/8] Pulling latest code from GitHub...${NC}"
if [ -d "${REPO_DIR}" ]; then
    cd ${REPO_DIR} && git pull origin main
else
    echo -e "${RED}✗ Repo not found at ${REPO_DIR}${NC}"
    echo -e "  Run: git clone <YOUR_REPO_URL> ${REPO_DIR}"
    cd ${BACKEND_DIR} && php artisan up
    exit 1
fi

# ── 3. Sync Backend files ────────────────────────────
echo -e "${YELLOW}[3/8] Syncing backend files...${NC}"
rsync -a --exclude='.git' --exclude='.env' --exclude='storage/app' \
    --exclude='storage/framework/cache/data' --exclude='storage/framework/sessions' \
    --exclude='storage/framework/views' --exclude='storage/logs' \
    "${REPO_DIR}/ISP-Backend/" "${BACKEND_DIR}/"
echo -e "${GREEN}  ✓ Backend synced${NC}"

if [ -f "${BACKEND_DIR}/deploy/nginx-smartispapp.conf" ] && [ -f "${BACKEND_DIR}/deploy/nginx-rate-limits.conf" ]; then
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d
    cp "${BACKEND_DIR}/deploy/nginx-smartispapp.conf" /etc/nginx/sites-available/smartispapp.com
    cp "${BACKEND_DIR}/deploy/nginx-rate-limits.conf" /etc/nginx/conf.d/smartisp-rate-limits.conf
    rm -f /etc/nginx/sites-enabled/smartisp
    ln -sf /etc/nginx/sites-available/smartispapp.com /etc/nginx/sites-enabled/smartispapp.com
    rm -f /etc/nginx/sites-enabled/default
    echo -e "${GREEN}  ✓ Nginx config synced${NC}"
fi

# ── 4. Sync Frontend files ──────────────────────────
echo -e "${YELLOW}[4/8] Syncing frontend files...${NC}"
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

# ── 5. Backend update ───────────────────────────────
echo -e "${YELLOW}[5/8] Updating backend dependencies...${NC}"
cd ${BACKEND_DIR}
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan modules:scan 2>/dev/null || true

# ── 6. Frontend build ───────────────────────────────
echo -e "${YELLOW}[6/8] Building frontend...${NC}"
cd ${FRONTEND_DIR}
npm ci --legacy-peer-deps
VITE_DEPLOY_TARGET=vps npm run build

# ── 7. Deploy frontend ──────────────────────────────
echo -e "${YELLOW}[7/8] Deploying frontend build...${NC}"
rsync -a --delete ${FRONTEND_DIR}/dist/ ${APP_DIR}/public_html/

# ── 8. Cache, permissions & restart ─────────────────
echo -e "${YELLOW}[8/8] Caching, permissions & restart...${NC}"
cd ${BACKEND_DIR}
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan storage:link 2>/dev/null || true

chown -R www-data:www-data ${APP_DIR}/public_html
chmod -R u=rwX,go=rX ${APP_DIR}/public_html
chown -R www-data:www-data ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache
chmod -R 775 ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache

systemctl restart php${PHP_VERSION}-fpm
nginx -t
systemctl reload nginx

cd ${BACKEND_DIR}
php artisan up

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Update complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Verify: curl -s https://smartispapp.com/api/health"
