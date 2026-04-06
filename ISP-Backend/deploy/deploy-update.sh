#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Smart ISP — Production Update Script
# Usage: sudo ./deploy-update.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/smartisp"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
PHP_VERSION="8.2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══ Smart ISP — Production Update ═══${NC}"

# ── 1. Maintenance mode ──────────────────────────────
echo -e "${YELLOW}[1/7] Maintenance mode ON...${NC}"
cd ${BACKEND_DIR}
php artisan down --retry=60 2>/dev/null || true

# ── 2. Pull latest code ─────────────────────────────
echo -e "${YELLOW}[2/7] Pulling latest code...${NC}"
cd ${BACKEND_DIR} && git pull origin main
cd ${FRONTEND_DIR} && git pull origin main

# ── 3. Backend update ───────────────────────────────
echo -e "${YELLOW}[3/7] Updating backend...${NC}"
cd ${BACKEND_DIR}
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force

# ── 4. Frontend build ───────────────────────────────
echo -e "${YELLOW}[4/7] Building frontend...${NC}"
cd ${FRONTEND_DIR}
npm ci
VITE_DEPLOY_TARGET=vps npm run build

# ── 5. Deploy frontend ──────────────────────────────
echo -e "${YELLOW}[5/7] Deploying frontend...${NC}"
rsync -a --delete ${FRONTEND_DIR}/dist/ ${APP_DIR}/public_html/

# ── 6. Cache & permissions ──────────────────────────
echo -e "${YELLOW}[6/7] Caching & permissions...${NC}"
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

# ── 7. Restart & go live ────────────────────────────
echo -e "${YELLOW}[7/7] Restarting services...${NC}"
systemctl restart php${PHP_VERSION}-fpm
systemctl reload nginx

cd ${BACKEND_DIR}
php artisan up

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Update complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Verify: curl -s https://smartispapp.com/api/api/health"
