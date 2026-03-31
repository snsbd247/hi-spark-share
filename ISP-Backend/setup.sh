#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   Smart ISP — Auto Setup for cPanel (Any Domain)            ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     Smart ISP v1.0.2 — cPanel Setup              ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Step 0: Ask Domain ───────────────────────────────────
echo -e "${YELLOW}  Domain Configuration:${NC}"
read -p "  Your Domain (e.g. isp.example.com): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

# ─── Step 1: Check Requirements ───────────────────────────
echo -e "${BLUE}[1/10] Checking requirements...${NC}"

if ! command -v php &> /dev/null; then
    echo -e "${RED}✗ PHP not found!${NC}"
    exit 1
fi

PHP_VERSION=$(php -r 'echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;')
PHP_MAJOR=$(php -r 'echo PHP_MAJOR_VERSION;')
PHP_MINOR=$(php -r 'echo PHP_MINOR_VERSION;')

if [ "$PHP_MAJOR" -lt 8 ] || ([ "$PHP_MAJOR" -eq 8 ] && [ "$PHP_MINOR" -lt 1 ]); then
    echo -e "${RED}✗ PHP 8.1+ required! Found: PHP ${PHP_VERSION}${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ PHP ${PHP_VERSION} found${NC}"

# Check required PHP extensions
REQUIRED_EXTS=("pdo_mysql" "mbstring" "openssl" "json" "curl" "tokenizer" "xml")
for ext in "${REQUIRED_EXTS[@]}"; do
    if php -m 2>/dev/null | grep -qi "^${ext}$"; then
        echo -e "${GREEN}  ✓ ext-${ext}${NC}"
    else
        echo -e "${YELLOW}  ⚠ ext-${ext} not found (may cause issues)${NC}"
    fi
done

if ! command -v composer &> /dev/null; then
    echo -e "${YELLOW}  ⚠ Composer not found. Installing locally...${NC}"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php composer-setup.php --quiet
    rm -f composer-setup.php
    COMPOSER_CMD="php composer.phar"
else
    COMPOSER_CMD="composer"
    echo -e "${GREEN}  ✓ Composer found${NC}"
fi

# ─── Step 2: Install Dependencies ─────────────────────────
echo -e "${BLUE}[2/10] Installing dependencies...${NC}"
$COMPOSER_CMD install --optimize-autoloader --no-dev --no-interaction 2>&1 | tail -5
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ─── Step 3: Environment Setup ────────────────────────────
echo -e "${BLUE}[3/10] Setting up environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}  ✓ .env created from .env.example${NC}"

    echo ""
    echo -e "${YELLOW}  Database Configuration:${NC}"
    read -p "  DB_DATABASE [isp_management]: " DB_NAME
    DB_NAME=${DB_NAME:-isp_management}

    read -p "  DB_USERNAME [root]: " DB_USER
    DB_USER=${DB_USER:-root}

    read -sp "  DB_PASSWORD: " DB_PASS
    echo ""

    # Use sed compatible with both GNU and BSD
    sed -i.bak "s|APP_ENV=.*|APP_ENV=production|" .env
    sed -i.bak "s|APP_DEBUG=.*|APP_DEBUG=false|" .env
    sed -i.bak "s|APP_URL=.*|APP_URL=https://${DOMAIN}/api|" .env
    sed -i.bak "s|FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" .env
    sed -i.bak "s|DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
    sed -i.bak "s|DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
    sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
    sed -i.bak "s|SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${DOMAIN},www.${DOMAIN}|" .env
    rm -f .env.bak

    echo -e "${GREEN}  ✓ .env configured for ${DOMAIN}${NC}"
else
    echo -e "${GREEN}  ✓ .env already exists (skipping)${NC}"
fi

# ─── Step 4: Generate Key ─────────────────────────────────
echo -e "${BLUE}[4/10] Generating app key...${NC}"
if grep -q "APP_KEY=$" .env || grep -q "APP_KEY=base64:" .env; then
    php artisan key:generate --force --no-interaction 2>/dev/null
    echo -e "${GREEN}  ✓ App key generated${NC}"
else
    echo -e "${GREEN}  ✓ App key already exists${NC}"
fi

# ─── Step 5: Clear caches ────────────────────────────────
echo -e "${BLUE}[5/10] Clearing caches...${NC}"
php artisan config:clear 2>/dev/null || true
php artisan cache:clear 2>/dev/null || true
php artisan route:clear 2>/dev/null || true
php artisan view:clear 2>/dev/null || true
echo -e "${GREEN}  ✓ Caches cleared${NC}"

# ─── Step 6: Run Migrations ──────────────────────────────
echo -e "${BLUE}[6/10] Running migrations...${NC}"
php artisan migrate --force --no-interaction 2>&1 | tail -5
echo -e "${GREEN}  ✓ Database tables created${NC}"

# ─── Step 7: Seed Default Data ───────────────────────────
echo -e "${BLUE}[7/10] Seeding default data...${NC}"

MAX_RETRIES=3
RETRY=0
SEED_SUCCESS=false

while [ $RETRY -lt $MAX_RETRIES ]; do
    if php artisan db:seed --class=DefaultSeeder --force --no-interaction 2>&1; then
        SEED_SUCCESS=true
        break
    else
        RETRY=$((RETRY + 1))
        echo -e "${YELLOW}  ⚠ Seed attempt $RETRY failed, retrying...${NC}"
        sleep 2
    fi
done

if [ "$SEED_SUCCESS" = true ]; then
    echo -e "${GREEN}  ✓ Default data seeded${NC}"
else
    echo -e "${YELLOW}  ⚠ Seed warning (data may already exist)${NC}"
fi

echo -e "${CYAN}    Admin #1: admin / admin123${NC}"
echo -e "${CYAN}    Admin #2: ismail / Admin@123${NC}"

# ─── Step 8: Seed Geo Data ───────────────────────────────
echo -e "${BLUE}[8/10] Seeding Bangladesh geo data...${NC}"
if php artisan db:seed --class=GeoSeeder --force --no-interaction 2>&1; then
    echo -e "${GREEN}  ✓ Geo data seeded (8 divisions, 64 districts, 495 upazilas)${NC}"
else
    echo -e "${YELLOW}  ⚠ Geo seeder skipped (already seeded or not found)${NC}"
fi

# ─── Step 9: Storage & Permissions ───────────────────────
echo -e "${BLUE}[9/10] Setting up storage & permissions...${NC}"
php artisan storage:link 2>/dev/null || true

# Create required directories
mkdir -p storage/app/public/avatars 2>/dev/null || true
mkdir -p storage/app/public/logos 2>/dev/null || true
mkdir -p storage/app/public/documents 2>/dev/null || true
mkdir -p storage/framework/sessions 2>/dev/null || true
mkdir -p storage/framework/views 2>/dev/null || true
mkdir -p storage/framework/cache/data 2>/dev/null || true

# Fix permissions
chmod -R 775 storage bootstrap/cache 2>/dev/null || true
find storage -type f -exec chmod 664 {} \; 2>/dev/null || true
find storage -type d -exec chmod 775 {} \; 2>/dev/null || true
echo -e "${GREEN}  ✓ Storage linked & permissions set${NC}"

# ─── Step 10: Production Cache ───────────────────────────
echo -e "${BLUE}[10/10] Building production cache...${NC}"
php artisan config:cache 2>/dev/null || true
php artisan route:cache 2>/dev/null || true
php artisan view:cache 2>/dev/null || true
echo -e "${GREEN}  ✓ Config, routes, views cached${NC}"

# ─── Create .htaccess if missing ─────────────────────────
if [ ! -f .htaccess ]; then
    cat > .htaccess << 'HTACCESS'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
HTACCESS
    echo -e "${GREEN}  ✓ Root .htaccess created${NC}"
fi

# ─── Done ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           ✅ Setup Complete!                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Domain:${NC}   https://${DOMAIN}"
echo -e "  ${GREEN}API:${NC}      https://${DOMAIN}/api/api"
echo -e "  ${GREEN}Login:${NC}    https://${DOMAIN}/admin/login"
echo -e "  ${GREEN}Portal:${NC}   https://${DOMAIN}/portal/login"
echo ""
echo -e "  ${YELLOW}API Base URL:${NC} Auto-detected — no VITE_API_URL needed"
echo -e "  ${YELLOW}Frontend:${NC}     npm run build → upload dist/ to document root"
echo ""
echo -e "  ${GREEN}Seeded Data:${NC}"
echo -e "    ✓ 7 Roles (Super Admin, Admin, Staff, Manager, Operator, Technician, Accountant)"
echo -e "    ✓ 2 Admin Users (admin/admin123, ismail/Admin@123)"
echo -e "    ✓ 4 Default Packages (10/20/50/100 Mbps)"
echo -e "    ✓ 50+ Chart of Accounts (ISP-specific COA with hierarchy)"
echo -e "    ✓ 18 Ledger Mappings & Payment Settings"
echo -e "    ✓ 8 SMS Templates + 5 Email Templates"
echo -e "    ✓ 56 Permissions (14 modules × 4 actions)"
echo -e "    ✓ System Settings & General Settings"
echo ""
echo -e "  ${YELLOW}Cron Job (cPanel → Cron Jobs):${NC}"
echo -e "  * * * * * cd $(pwd) && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo -e "  ${YELLOW}HTTP Setup (no SSH alternative):${NC}"
echo -e "  POST https://${DOMAIN}/api/api/setup/full"
echo -e "  Header: X-Setup-Token: <your APP_KEY without base64: prefix>"
echo ""
