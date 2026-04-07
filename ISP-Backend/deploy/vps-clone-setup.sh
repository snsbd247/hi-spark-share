#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Smart ISP — VPS Clone Setup Script (v1.0.6)
# Maps GitHub repo files → /var/www/smartisp directory structure
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   1. Clone repo:  git clone <YOUR_REPO_URL> /tmp/smartisp-repo
#   2. Run:         sudo bash /tmp/smartisp-repo/ISP-Backend/deploy/vps-clone-setup.sh
#
# Prerequisites: Run vps-setup.sh first to install PHP, MySQL, Nginx, Node.js
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
REPO_DIR="/tmp/smartisp-repo"
APP_DIR="/var/www/smartisp"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
PHP_VERSION="8.2"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}═══ $1 ═══${NC}\n"; }

# ── Pre-checks ────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "Please run as root: sudo bash vps-clone-setup.sh"
fi

if [ ! -d "${REPO_DIR}" ]; then
    err "Repo not found at ${REPO_DIR}. Clone it first:\n  git clone <YOUR_REPO_URL> ${REPO_DIR}"
fi

if [ ! -d "${APP_DIR}" ]; then
    err "App directory ${APP_DIR} not found. Run vps-setup.sh first!"
fi

section "1/7 — Syncing Backend Files"
mkdir -p ${BACKEND_DIR}

rsync -a --exclude='.git' --exclude='.env' --exclude='vendor' \
    --exclude='storage/app/public/*' \
    --exclude='storage/framework/cache/data/*' \
    --exclude='storage/framework/sessions/*' \
    --exclude='storage/framework/views/*' \
    --exclude='storage/logs/*' \
    --exclude='deploy' \
    "${REPO_DIR}/ISP-Backend/" "${BACKEND_DIR}/"

log "Backend files synced to ${BACKEND_DIR}"

# ── Copy deploy scripts ──────────────────────────────────────
section "2/7 — Copying Deploy Scripts & Nginx Config"
cp "${REPO_DIR}/ISP-Backend/deploy/deploy-update.sh" "${APP_DIR}/deploy-update.sh"
cp "${REPO_DIR}/ISP-Backend/deploy/vps-setup.sh" "${APP_DIR}/vps-setup.sh" 2>/dev/null || true
cp "${REPO_DIR}/ISP-Backend/deploy/vps-clone-setup.sh" "${APP_DIR}/vps-clone-setup.sh" 2>/dev/null || true
chmod +x ${APP_DIR}/*.sh

if [ -f "${REPO_DIR}/ISP-Backend/deploy/nginx-smartispapp.conf" ] && [ -f "${REPO_DIR}/ISP-Backend/deploy/nginx-rate-limits.conf" ]; then
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d
    cp "${REPO_DIR}/ISP-Backend/deploy/nginx-smartispapp.conf" /etc/nginx/sites-available/smartispapp.com
    cp "${REPO_DIR}/ISP-Backend/deploy/nginx-rate-limits.conf" /etc/nginx/conf.d/smartisp-rate-limits.conf
    rm -f /etc/nginx/sites-enabled/smartisp
    ln -sf /etc/nginx/sites-available/smartispapp.com /etc/nginx/sites-enabled/smartispapp.com
    rm -f /etc/nginx/sites-enabled/default
    log "Nginx config refreshed"
else
    warn "Nginx templates missing in deploy directory; skipped Nginx sync"
fi

if [ -f "${REPO_DIR}/ISP-Backend/deploy/smartisp-queue.service" ]; then
    cp "${REPO_DIR}/ISP-Backend/deploy/smartisp-queue.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable smartisp-queue 2>/dev/null || true
    log "Queue worker service installed"
fi

log "Deploy scripts copied"

# ── Sync Frontend Files ──────────────────────────────────────
section "3/7 — Syncing Frontend Files"
mkdir -p ${FRONTEND_DIR}

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

log "Frontend files synced to ${FRONTEND_DIR}"

# ── Backend Setup ─────────────────────────────────────────────
section "4/7 — Backend Setup (Composer + .env)"
cd ${BACKEND_DIR}

# Create .env if not exists
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    if [ -f "${REPO_DIR}/ISP-Backend/deploy/env.production" ]; then
        cp "${REPO_DIR}/ISP-Backend/deploy/env.production" "${BACKEND_DIR}/.env"
        warn ".env created from env.production — UPDATE database credentials!"
    elif [ -f "${BACKEND_DIR}/.env.example" ]; then
        cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
        warn ".env created from .env.example — UPDATE database credentials!"
    fi
    php artisan key:generate --force
    log "APP_KEY generated"
fi

# Storage directories
mkdir -p storage/app/public storage/framework/{cache/data,sessions,views} storage/logs
mkdir -p bootstrap/cache

composer install --no-dev --optimize-autoloader --no-interaction
log "Composer dependencies installed"

# ── Database Migration + Seeding ──────────────────────────────
section "5/7 — Database Migration & Seeding"
cd ${BACKEND_DIR}

# Fresh install: drop all tables and re-migrate
if [ "${FRESH_INSTALL:-}" = "true" ]; then
    warn "FRESH INSTALL mode — dropping all tables..."
    php artisan db:wipe --force
    log "All tables dropped"
fi

php artisan migrate --force
log "Database migrated"

php artisan db:seed --class=DefaultSeeder --force
log "Default data seeded (roles, users, COA, ledger, permissions, modules)"

php artisan db:seed --class=GeoSeeder --force 2>/dev/null || warn "GeoSeeder skipped (may not exist)"

php artisan db:seed --class=SaasSeeder --force 2>/dev/null || warn "SaasSeeder skipped (may not exist)"

php artisan modules:scan 2>/dev/null || true
php artisan storage:link 2>/dev/null || true
log "Database setup complete"

# ── Frontend Build ────────────────────────────────────────────
section "6/7 — Building Frontend"
cd ${FRONTEND_DIR}

npm ci --legacy-peer-deps
VITE_DEPLOY_TARGET=vps npm run build

# Deploy build to public_html
mkdir -p ${APP_DIR}/public_html
rsync -a --delete ${FRONTEND_DIR}/dist/ ${APP_DIR}/public_html/

log "Frontend built and deployed to public_html"

# ── Permissions & Cache ──────────────────────────────────────
section "7/7 — Permissions, Cache & Restart"
cd ${BACKEND_DIR}

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Permissions
chown -R www-data:www-data ${APP_DIR}/public_html
chmod -R u=rwX,go=rX ${APP_DIR}/public_html

chown -R www-data:www-data ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache
chmod -R 775 ${BACKEND_DIR}/storage ${BACKEND_DIR}/bootstrap/cache

# Restart services
nginx -t
systemctl restart php${PHP_VERSION}-fpm
systemctl reload nginx
systemctl restart smartisp-queue 2>/dev/null || true

log "Services restarted"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Smart ISP Clone Setup Complete! (v1.0.6)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Directories:${NC}"
echo -e "    Backend:   ${BACKEND_DIR}"
echo -e "    Frontend:  ${FRONTEND_DIR}"
echo -e "    Web Root:  ${APP_DIR}/public_html"
echo ""
echo -e "  ${YELLOW}Default Logins:${NC}"
echo -e "    Super Admin:  superadmin / Admin@123"
echo -e "    Tenant Admin: snb_admin  / 123456"
echo -e "    Reseller:     sagorkhan  / 123456"
echo ""
echo -e "  ${YELLOW}Services:${NC}"
echo -e "    PHP-FPM:      systemctl status php${PHP_VERSION}-fpm"
echo -e "    Nginx:        systemctl status nginx"
echo -e "    Queue Worker: systemctl status smartisp-queue"
echo ""
echo -e "  ${YELLOW}Next Steps:${NC}"
echo -e "    1. Edit ${BACKEND_DIR}/.env — set DB credentials, APP_URL, etc."
echo -e "    2. Set up SSL certificate"
echo -e "    3. Test: curl -s https://your-domain.com/api/health"
echo ""
echo -e "  ${YELLOW}Future Updates:${NC}"
echo -e "    cd ${REPO_DIR} && git pull origin main"
echo -e "    sudo ${APP_DIR}/deploy-update.sh"
echo ""
