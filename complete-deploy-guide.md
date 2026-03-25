# Smart ISP — সম্পূর্ণ Deploy গাইড (শুরু থেকে শেষ)
# যে কোনো Domain ও cPanel এ কাজ করবে (Domain-Agnostic)

---

## 🟢 Part A: আপনার লোকাল মেশিনে কি কি করতে হবে

### Step 1: প্রজেক্ট ডাউনলোড/ক্লোন করুন

GitHub থেকে clone করুন:
```bash
git clone <YOUR_GIT_URL> smart-isp
cd smart-isp
```

### Step 2: Node.js dependencies install

```bash
npm install
```

### Step 3: React Frontend Build করুন

```bash
npm run build
```

> ✅ এই command রান করলেই `dist/` ফোল্ডার তৈরি হবে!
> এটাই আপনি খুঁজছিলেন। `npm run build` না করলে `dist/` থাকবে না।

Build শেষে এরকম দেখাবে:
```
smart-isp/
├── dist/                 ← 🎯 এটাই! Build করলে তৈরি হয়
│   ├── index.html
│   ├── assets/
│   │   ├── index-abc123.js
│   │   └── index-abc123.css
│   └── favicon.ico
├── laravel-backend/      ← এটা cPanel এ api/ তে যাবে
├── public/
│   └── .htaccess         ← এটা document root এ যাবে
├── src/
└── ...
```

---

## 🟢 Part B: cPanel এ Laravel Backend আপলোড

### Step 4: laravel-backend/ ফোল্ডার ZIP করুন

আপনার লোকাল মেশিনে:
- `laravel-backend/` ফোল্ডারে যান
- সব ফাইল সিলেক্ট করুন
- **ZIP** করুন → `laravel-backend.zip`

### Step 5: cPanel এ আপলোড

1. **cPanel → File Manager** ওপেন করুন
2. আপনার domain এর document root এ যান (যেমন `public_html/yourdomain.com/`)
3. **+ Folder** বাটনে ক্লিক করুন → নাম দিন: `api`
4. `api/` ফোল্ডারে ঢুকুন
5. **Upload** বাটনে ক্লিক করুন
6. `laravel-backend.zip` আপলোড করুন
7. ZIP ফাইলে **Right Click → Extract**
8. Extract হওয়ার পর ZIP ফাইলটা ডিলিট করুন

> ⚠️ Extract এর পর চেক করুন ফাইলগুলো সরাসরি `api/` তে আছে কিনা।
> যদি `api/laravel-backend/app/` এরকম হয়, তাহলে ভিতরের সব ফাইল `api/` তে Move করুন।

সঠিক structure:
```
<document-root>/api/
├── app/            ✅ সঠিক
├── bootstrap/
├── config/
├── database/
├── routes/
├── artisan
├── composer.json
└── setup.sh
```

ভুল structure (এটা হলে ঠিক করুন):
```
<document-root>/api/
└── laravel-backend/     ❌ এরকম হলে ভিতরের সব Move করুন api/ তে
    ├── app/
    └── ...
```

### Step 6: setup.sh রান করুন (SSH)

**cPanel → Terminal** (অথবা SSH client দিয়ে connect করুন):

```bash
cd <document-root>/api
bash setup.sh
```

Script আপনাকে জিজ্ঞেস করবে:
```
DB_DATABASE [your_db_name]: → Enter চাপুন অথবা নাম দিন
DB_USERNAME [your_db_user]: → আপনার cPanel DB user
DB_PASSWORD: → পাসওয়ার্ড টাইপ করুন (দেখাবে না)
```

> ⚠️ **SSH নেই?** তাহলে নিচের Step 6B দেখুন।

### Step 6B: SSH ছাড়া (Manual পদ্ধতি)

SSH না থাকলে এই কাজগুলো আলাদা আলাদা করতে হবে:

**1) লোকালে Composer Install:**
```bash
cd laravel-backend
composer install --optimize-autoloader --no-dev
```
তারপর `vendor/` ফোল্ডারসহ ZIP করে আপলোড করুন।

**2) cPanel → MySQL Databases:**
- New Database: `your_db_name`
- New User: `your_db_user` + password
- Add User to Database → **All Privileges** ✓

**3) .env ফাইল তৈরি:**
- cPanel File Manager → `api/` ফোল্ডারে যান
- `.env.example` ফাইলে Right Click → **Copy** → নাম: `.env`
- `.env` ফাইলে Right Click → **Edit** → নিচের মান বসান:

```env
APP_NAME="Smart ISP"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com/api
FRONTEND_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_password

SANCTUM_STATEFUL_DOMAINS=yourdomain.com,www.yourdomain.com
```

**4) PHP Commands (cPanel → Terminal বা Cron Job দিয়ে):**

যদি cPanel এ Terminal থাকে:
```bash
cd <document-root>/api
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan config:cache
php artisan route:cache
```

Terminal না থাকলে **Cron Job দিয়ে** একবার রান করুন:
- cPanel → Cron Jobs → Add New:
```
* * * * * cd <document-root>/api && php artisan key:generate && php artisan migrate --seed && php artisan storage:link && php artisan config:cache && php artisan route:cache >> /home/<cpanel-user>/setup-log.txt 2>&1
```
- 2 মিনিট পর Cron Job টা **ডিলিট** করুন
- `/home/<cpanel-user>/setup-log.txt` চেক করুন

**5) api/.htaccess তৈরি:**
- cPanel File Manager → `api/` ফোল্ডারে
- **+ File** → নাম: `.htaccess`
- Edit করে বসান:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

---

## 🟢 Part C: React Frontend আপলোড

### Step 7: dist/ ফোল্ডার আপলোড

1. লোকালে `dist/` ফোল্ডারের ভিতরের সব ফাইল ZIP করুন → `frontend.zip`
2. cPanel File Manager → document root এ যান
3. **Upload** → `frontend.zip` আপলোড
4. **Right Click → Extract**
5. ZIP ডিলিট করুন

### Step 8: SPA .htaccess আপলোড

`public/.htaccess` ফাইলটা document root এ `.htaccess` হিসেবে আপলোড করুন।

অথবা cPanel এ `.htaccess` তৈরি করুন:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>
```

---

## ✅ Final Check

### cPanel এ পুরো structure:
```
<document-root>/
├── .htaccess             ← SPA routing
├── index.html            ← React app
├── assets/               ← JS/CSS files
├── favicon.ico
└── api/                  ← Laravel
    ├── .htaccess         ← RewriteRule to public/
    ├── .env              ← Production config
    ├── app/
    ├── bootstrap/
    ├── config/
    ├── database/
    ├── public/
    ├── routes/
    ├── storage/
    └── vendor/
```

### Test করুন:
1. `https://yourdomain.com` → Login page দেখাবে
2. `https://yourdomain.com/api/api/admin/login` → API response আসবে
3. আপনার admin credentials দিয়ে login করুন

---

## 🔄 Cron Job (Scheduler)

cPanel → Cron Jobs → প্রতি মিনিটে:
```
* * * * * cd <document-root>/api && php artisan schedule:run >> /dev/null 2>&1
```

---

## ⚠️ Common সমস্যা ও সমাধান

| সমস্যা | কারণ | সমাধান |
|--------|------|--------|
| dist/ ফোল্ডার নেই | Build করেননি | `npm run build` রান করুন |
| 500 Error | Permission | `chmod -R 775 storage bootstrap/cache` |
| Blank page | .htaccess নেই | SPA .htaccess যোগ করুন |
| Network Error (login) | API URL ভুল | `.env.production` চেক করুন |
| CORS Error | Domain mismatch | Laravel `config/cors.php` চেক |
| 404 on refresh | SPA routing নেই | `.htaccess` চেক |
