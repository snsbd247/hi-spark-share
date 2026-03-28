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
echo "║     Smart ISP — cPanel Setup                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Step 0: Ask Domain ───────────────────────────────────
echo -e "${YELLOW}  Domain Configuration:${NC}"
read -p "  Your Domain (e.g. isp.example.com): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

# ─── Step 1: Check Requirements ───────────────────────────
echo -e "${BLUE}[1/8] Checking requirements...${NC}"

if ! command -v php &> /dev/null; then
    echo -e "${RED}✗ PHP not found!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ PHP $(php -r 'echo PHP_VERSION;') found${NC}"

if ! command -v composer &> /dev/null; then
    echo -e "${YELLOW}  ⚠ Composer not found. Installing...${NC}"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php composer-setup.php
    rm -f composer-setup.php
    COMPOSER_CMD="php composer.phar"
else
    COMPOSER_CMD="composer"
    echo -e "${GREEN}  ✓ Composer found${NC}"
fi

# ─── Step 2: Install Dependencies ─────────────────────────
echo -e "${BLUE}[2/8] Installing dependencies...${NC}"
$COMPOSER_CMD install --optimize-autoloader --no-dev --no-interaction 2>&1 | tail -3
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ─── Step 3: Environment Setup ────────────────────────────
echo -e "${BLUE}[3/8] Setting up environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}  ✓ .env created${NC}"

    # Interactive setup
    echo ""
    echo -e "${YELLOW}  Database Configuration:${NC}"
    read -p "  DB_DATABASE [isp_management]: " DB_NAME
    DB_NAME=${DB_NAME:-isp_management}

    read -p "  DB_USERNAME [root]: " DB_USER
    DB_USER=${DB_USER:-root}

    read -sp "  DB_PASSWORD: " DB_PASS
    echo ""

    # Update .env
    sed -i "s|APP_ENV=.*|APP_ENV=production|" .env
    sed -i "s|APP_DEBUG=.*|APP_DEBUG=false|" .env
    sed -i "s|APP_URL=.*|APP_URL=https://${DOMAIN}/api|" .env
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" .env
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
    sed -i "s|DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
    sed -i "s|SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${DOMAIN},www.${DOMAIN}|" .env

    echo -e "${GREEN}  ✓ .env configured for ${DOMAIN}${NC}"
else
    echo -e "${GREEN}  ✓ .env already exists${NC}"
fi

# ─── Step 4: Generate Key ─────────────────────────────────
echo -e "${BLUE}[4/8] Generating app key...${NC}"
php artisan key:generate --force --no-interaction
echo -e "${GREEN}  ✓ App key generated${NC}"

# ─── Step 5: Run Migrations ───────────────────────────────
echo -e "${BLUE}[5/8] Running migrations...${NC}"
php artisan migrate --force --no-interaction
echo -e "${GREEN}  ✓ Database tables created${NC}"

# ─── Step 6: Seed Data ────────────────────────────────────
echo -e "${BLUE}[6/8] Seeding default data...${NC}"
php artisan db:seed --force --no-interaction
echo -e "${GREEN}  ✓ Data seeded${NC}"
echo -e "${CYAN}    Admin #1: admin / admin123${NC}"
echo -e "${CYAN}    Admin #2: ismail / Admin@123${NC}"

# ─── Step 7: Storage & Permissions ────────────────────────
echo -e "${BLUE}[7/8] Setting permissions...${NC}"
php artisan storage:link 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true
echo -e "${GREEN}  ✓ Storage linked & permissions set${NC}"

# ─── Step 8: Production Cache ─────────────────────────────
echo -e "${BLUE}[8/8] Caching for production...${NC}"
php artisan config:cache
php artisan route:cache
php artisan view:cache
echo -e "${GREEN}  ✓ Cached${NC}"

# ─── Create api/.htaccess if missing ──────────────────────
if [ ! -f .htaccess ]; then
    cat > .htaccess << 'HTACCESS'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
HTACCESS
    echo -e "${GREEN}  ✓ .htaccess created${NC}"
fi

# ─── Done ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           ✅ Setup Complete!                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Domain:${NC}  https://${DOMAIN}"
echo -e "  ${GREEN}API:${NC}    https://${DOMAIN}/api/api"
echo -e "  ${GREEN}Login:${NC}  https://${DOMAIN}/login"
echo ""
echo -e "  ${YELLOW}Cron Job (cPanel → Cron Jobs):${NC}"
echo -e "  * * * * * cd $(pwd) && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo -e "  ${YELLOW}Next: React frontend build আপলোড করুন${NC}"
echo -e "  npm run build → dist/ → document root"
echo ""
