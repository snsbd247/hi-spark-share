# Smart ISP — React Frontend Build ও Deploy গাইড
# যে কোনো Domain এ কাজ করবে (Domain-Agnostic)

## 📋 প্রয়োজনীয়তা
- আপনার লোকাল মেশিনে Node.js 18+ ও npm ইনস্টল থাকতে হবে
- প্রজেক্টের source code থাকতে হবে

---

## 🔨 Step 1: .env.production চেক করুন

`.env.production` ফাইলে API URL সেট করুন (অথবা খালি রাখলে auto-detect হবে):

```
# আপনার ডোমেইন অনুযায়ী সেট করুন:
VITE_API_URL="https://yourdomain.com/api/api"

# অথবা খালি রাখুন — অ্যাপ নিজেই ডোমেইন detect করবে:
VITE_API_URL=""
```

> **Auto-detect**: খালি রাখলে অ্যাপ `https://<current-domain>/api/api` ব্যবহার করবে।

---

## 🔨 Step 2: Build করুন

```bash
# প্রজেক্ট ফোল্ডারে যান
cd smart-isp

# Dependencies install (যদি আগে না করে থাকেন)
npm install

# Production build
npm run build
```

Build শেষে `dist/` ফোল্ডার তৈরি হবে:

```
dist/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   ├── index-xxxxx.css
│   └── (other chunks)
└── (other files like favicon, robots.txt)
```

---

## 🔨 Step 3: cPanel এ আপলোড

### Option A: cPanel File Manager দিয়ে

1. **cPanel → File Manager** ওপেন করুন
2. আপনার domain এর document root ফোল্ডারে যান (যেমন `public_html/yourdomain.com/`)
3. **Upload** বাটনে ক্লিক করুন

#### আপলোড করার ফাইলগুলো:

| লোকাল ফাইল/ফোল্ডার | cPanel এ রাখবেন |
|---|---|
| `dist/index.html` | `<document-root>/index.html` |
| `dist/assets/` (পুরো ফোল্ডার) | `<document-root>/assets/` |
| `dist/favicon.ico` | `<document-root>/favicon.ico` |
| `public/.htaccess` | `<document-root>/.htaccess` |

> **টিপস:** `dist/` ফোল্ডারকে ZIP করে আপলোড করুন, তারপর cPanel এ Extract করুন — অনেক দ্রুত!

#### ZIP পদ্ধতি:
1. লোকালে: `dist/` ফোল্ডারের ভিতরের সব সিলেক্ট করে ZIP করুন
2. cPanel File Manager → document root → Upload → ZIP ফাইল আপলোড
3. ZIP ফাইলে Right Click → **Extract**
4. ZIP ফাইলটা ডিলিট করুন

### Option B: FTP দিয়ে (FileZilla)

1. FileZilla ওপেন করুন
2. Connect: `Host: yourdomain.com`, `Username: your_cpanel_user`, `Port: 21`
3. Remote site: `/public_html/yourdomain.com/`
4. Local site থেকে `dist/` এর ভিতরের সব ফাইল ড্র্যাগ করুন

---

## 🔨 Step 4: .htaccess ফাইল চেক

Document root এ `.htaccess` ফাইলে এটা আছে কিনা চেক করুন:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
</IfModule>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>
```

> এটা না থাকলে React SPA routing কাজ করবে না (refresh করলে 404 আসবে)

---

## 🔨 Step 5: Final Structure চেক

cPanel File Manager এ document root এরকম দেখাবে:

```
yourdomain.com/
├── api/                  ← Laravel backend (আগে আপলোড করেছেন)
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── ...
│   └── .htaccess
├── assets/               ← React build assets
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
├── index.html            ← React SPA entry
├── .htaccess             ← SPA routing
└── favicon.ico
```

---

## ✅ Step 6: Test করুন

1. ব্রাউজারে যান: `https://yourdomain.com`
2. Login page আসবে
3. আপনার admin credentials দিয়ে login করুন
4. Dashboard দেখা গেলে সব ঠিক আছে! ✅

---

## 🔄 পরবর্তী আপডেট করতে

যখনই কোড পরিবর্তন করবেন:

```bash
npm run build
```

তারপর শুধু `dist/` এর ফাইলগুলো আবার আপলোড করুন (api/ ফোল্ডারে হাত দিতে হবে না)।

---

## ⚠️ সমস্যা হলে

| সমস্যা | সমাধান |
|---|---|
| পেজ refresh এ 404 | `.htaccess` ফাইল চেক করুন |
| Login এ Network Error | API URL চেক: `https://yourdomain.com/api/api/admin/login` |
| Blank page | Browser Console (F12) এ error দেখুন |
| CORS error | Laravel `config/cors.php` এ domain যোগ করুন |
