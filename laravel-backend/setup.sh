#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║         Smart ISP — Laravel Backend Auto Setup              ║
# ║         cPanel / VPS / Local Development                    ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║       Smart ISP — Laravel Backend Setup          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Step 1: Check PHP & Composer ──────────────────────────────
echo -e "${BLUE}[1/9] Checking requirements...${NC}"

if ! command -v php &> /dev/null; then
    echo -e "${RED}✗ PHP not found. Please install PHP 8.2+${NC}"
    exit 1
fi

PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo -e "${GREEN}  ✓ PHP ${PHP_VERSION} found${NC}"

if ! command -v composer &> /dev/null; then
    echo -e "${YELLOW}  ⚠ Composer not found. Attempting to install...${NC}"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php composer-setup.php --install-dir=/usr/local/bin --filename=composer 2>/dev/null || \
    php composer-setup.php
    rm -f composer-setup.php
    COMPOSER_CMD="php composer.phar"
else
    COMPOSER_CMD="composer"
    echo -e "${GREEN}  ✓ Composer found${NC}"
fi

# ─── Step 2: Install Dependencies ──────────────────────────────
echo -e "${BLUE}[2/9] Installing PHP dependencies...${NC}"
$COMPOSER_CMD install --optimize-autoloader --no-dev --no-interaction 2>&1 | tail -3
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ─── Step 3: Environment Setup ─────────────────────────────────
echo -e "${BLUE}[3/9] Setting up environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}  ✓ .env file created from .env.example${NC}"
    echo ""
    echo -e "${YELLOW}  ⚠ Please configure your database credentials in .env:${NC}"
    echo -e "${YELLOW}    DB_DATABASE=your_database_name${NC}"
    echo -e "${YELLOW}    DB_USERNAME=your_database_user${NC}"
    echo -e "${YELLOW}    DB_PASSWORD=your_database_password${NC}"
    echo ""

    # Interactive database setup
    read -p "  Enter DB_DATABASE [isp_management]: " DB_NAME
    DB_NAME=${DB_NAME:-isp_management}

    read -p "  Enter DB_USERNAME [root]: " DB_USER
    DB_USER=${DB_USER:-root}

    read -sp "  Enter DB_PASSWORD []: " DB_PASS
    echo ""
    DB_PASS=${DB_PASS:-}

    read -p "  Enter DB_HOST [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    # Update .env file
    sed -i "s/DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" .env
    sed -i "s/DB_USERNAME=.*/DB_USERNAME=${DB_USER}/" .env
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
    sed -i "s/DB_HOST=.*/DB_HOST=${DB_HOST}/" .env

    echo -e "${GREEN}  ✓ Database credentials updated${NC}"
else
    echo -e "${GREEN}  ✓ .env file already exists${NC}"
fi

# ─── Step 4: Generate App Key ──────────────────────────────────
echo -e "${BLUE}[4/9] Generating application key...${NC}"
php artisan key:generate --force --no-interaction
echo -e "${GREEN}  ✓ App key generated${NC}"

# ─── Step 5: Create Database (MySQL) ───────────────────────────
echo -e "${BLUE}[5/9] Checking database...${NC}"

# Source .env values
DB_NAME=$(grep DB_DATABASE .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_USER=$(grep DB_USERNAME .env | head -1 | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_PASS=$(grep DB_PASSWORD .env | head -1 | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_HOST=$(grep DB_HOST .env | head -1 | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if command -v mysql &> /dev/null; then
    if [ -z "$DB_PASS" ]; then
        mysql -h "$DB_HOST" -u "$DB_USER" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null && \
        echo -e "${GREEN}  ✓ Database '${DB_NAME}' ready${NC}" || \
        echo -e "${YELLOW}  ⚠ Could not auto-create database. Create it manually in cPanel.${NC}"
    else
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null && \
        echo -e "${GREEN}  ✓ Database '${DB_NAME}' ready${NC}" || \
        echo -e "${YELLOW}  ⚠ Could not auto-create database. Create it manually in cPanel.${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ MySQL CLI not available. Make sure database '${DB_NAME}' exists.${NC}"
fi

# ─── Step 6: Run Migrations ───────────────────────────────────
echo -e "${BLUE}[6/9] Running database migrations...${NC}"
php artisan migrate --force --no-interaction
echo -e "${GREEN}  ✓ Migrations complete (32 tables created)${NC}"

# ─── Step 7: Seed Default Data ────────────────────────────────
echo -e "${BLUE}[7/9] Seeding default data...${NC}"
php artisan db:seed --force --no-interaction
echo -e "${GREEN}  ✓ Default data seeded${NC}"
echo -e "${CYAN}    Admin #1: username=admin, password=admin123${NC}"
echo -e "${CYAN}    Admin #2: username=ismail, password=Admin@123${NC}"

# ─── Step 8: Storage Link & Permissions ───────────────────────
echo -e "${BLUE}[8/9] Setting up storage & permissions...${NC}"
php artisan storage:link 2>/dev/null || echo -e "${YELLOW}  ⚠ Storage link may already exist${NC}"

# Set proper permissions
chmod -R 775 storage 2>/dev/null || true
chmod -R 775 bootstrap/cache 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

echo -e "${GREEN}  ✓ Storage linked & permissions set${NC}"

# ─── Step 9: Cache Config (Production) ────────────────────────
echo -e "${BLUE}[9/9] Optimizing for production...${NC}"

APP_ENV=$(grep APP_ENV .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
if [ "$APP_ENV" = "production" ]; then
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    echo -e "${GREEN}  ✓ Config, routes & views cached${NC}"
else
    php artisan config:clear 2>/dev/null || true
    php artisan route:clear 2>/dev/null || true
    echo -e "${GREEN}  ✓ Development mode — caches cleared${NC}"
fi

# ─── Done! ────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           ✅ Setup Complete!                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Your Laravel backend is ready!${NC}"
echo ""
echo -e "  ${YELLOW}Local development:${NC}"
echo -e "    php artisan serve"
echo -e "    → API: http://localhost:8000/api"
echo ""
echo -e "  ${YELLOW}cPanel deployment:${NC}"
echo -e "    → Copy this folder to public_html/api/"
echo -e "    → Copy cpanel-htaccess to public_html/api/.htaccess"
echo -e "    → API: https://yourdomain.com/api/api"
echo ""
echo -e "  ${YELLOW}Cron job (cPanel):${NC}"
echo -e "    * * * * * cd $(pwd) && php artisan schedule:run >> /dev/null 2>&1"
echo ""
echo -e "  ${YELLOW}Admin Login:${NC}"
echo -e "    Username: admin    Password: admin123"
echo -e "    Username: ismail   Password: Admin@123"
echo ""
