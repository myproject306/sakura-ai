# 🚀 Sakura AI — دليل النشر الكامل
## Frontend → Bluehost | Backend → Railway

---

## 📋 الخطوات بالترتيب

```
1. نشر الـ Backend على Railway
2. الحصول على رابط Railway
3. تحديث config.js بالرابط
4. رفع الـ Frontend على Bluehost
5. إعداد DNS على Bluehost
```

---

## 🔧 الخطوة 1: نشر الـ Backend على Railway

### 1.1 إنشاء حساب Railway
- اذهب إلى [railway.app](https://railway.app)
- سجّل دخول بـ GitHub

### 1.2 إنشاء مشروع جديد
1. اضغط **New Project**
2. اختر **Deploy from GitHub repo**
3. اختر مستودع `sakura-ai`
4. اختر مجلد `backend` كـ Root Directory

### 1.3 إضافة قاعدة بيانات PostgreSQL
1. في مشروع Railway، اضغط **+ New**
2. اختر **Database → PostgreSQL**
3. Railway سيضيف `DATABASE_URL` تلقائياً

### 1.4 تحديث Prisma Schema لـ PostgreSQL
افتح `backend/prisma/schema.prisma` وغيّر:
```prisma
datasource db {
  provider = "postgresql"   ← غيّر من "sqlite" إلى "postgresql"
  url      = env("DATABASE_URL")
}
```

### 1.5 إضافة متغيرات البيئة على Railway
في Railway → Variables، أضف:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://sakura.ai

# JWT (أنشئ قيم عشوائية قوية)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# AI APIs
OPENAI_API_KEY=sk-...
STABILITY_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Admin
ADMIN_EMAIL=admin@sakura.ai
ADMIN_PASSWORD=YourStrongPassword2025!
```

### 1.6 تشغيل Seed بعد النشر
في Railway → Shell:
```bash
node prisma/seed.js
```

### 1.7 الحصول على رابط Railway
- في Railway → Settings → Domains
- انسخ الرابط مثل: `https://sakura-ai-backend-production.up.railway.app`

---

## ⚙️ الخطوة 2: تحديث config.js

افتح `sakura-ai/config.js` وغيّر:
```javascript
BACKEND_URL: 'https://sakura-ai-backend-production.up.railway.app',
//                    ↑ ضع رابط Railway الحقيقي هنا
```

---

## 🌐 الخطوة 3: رفع الـ Frontend على Bluehost

### الملفات التي ترفعها على Bluehost (public_html):
```
✅ index.html
✅ auth.html
✅ pricing.html
✅ tools.html
✅ tool-interface.html
✅ dashboard.html
✅ checkout-success.html
✅ admin.html
✅ templates.html
✅ contact.html
✅ faq.html
✅ privacy.html
✅ terms.html
✅ refund.html
✅ styles.css
✅ script.js
✅ config.js          ← مهم جداً (بعد تحديثه بـ Railway URL)
✅ .htaccess
```

### ❌ لا ترفع هذه الملفات:
```
❌ backend/           ← هذا على Railway
❌ _test_dashboard.html
❌ _preview_tool.html
❌ TODO.md
❌ DEPLOY.md
❌ README.md
```

### طريقة الرفع:
1. سجّل دخول إلى **Bluehost cPanel**
2. افتح **File Manager**
3. اذهب إلى `public_html`
4. ارفع جميع الملفات المذكورة أعلاه

---

## 🌍 الخطوة 4: إعداد DNS على Bluehost

إذا اشتريت الدومين من Bluehost، فهو مضبوط تلقائياً.

إذا اشتريت الدومين من مكان آخر، أضف هذه السجلات:
```
Type: A     Name: @      Value: [Bluehost IP]
Type: A     Name: www    Value: [Bluehost IP]
Type: CNAME Name: www    Value: sakura.ai
```

---

## 🔒 الخطوة 5: تفعيل SSL على Bluehost

1. في cPanel → **SSL/TLS**
2. اضغط **Let's Encrypt**
3. اختر `sakura.ai` و `www.sakura.ai`
4. اضغط **Install**

---

## 🔗 الخطوة 6: إعداد Stripe Webhook

1. اذهب إلى [Stripe Dashboard](https://dashboard.stripe.com) → Webhooks
2. اضغط **Add endpoint**
3. URL: `https://sakura-ai-backend-production.up.railway.app/api/stripe/webhook`
4. اختر هذه الأحداث:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. انسخ **Webhook Secret** وضعه في Railway Variables كـ `STRIPE_WEBHOOK_SECRET`

---

## 🔑 الخطوة 7: إعداد Google OAuth

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → OAuth 2.0
3. أضف Authorized redirect URIs:
   ```
   https://sakura-ai-backend-production.up.railway.app/api/auth/google/callback
   ```

---

## ✅ قائمة التحقق النهائية

- [ ] Backend يعمل على Railway
- [ ] `DATABASE_URL` يشير إلى PostgreSQL
- [ ] جميع متغيرات البيئة مضبوطة على Railway
- [ ] `config.js` محدّث بـ Railway URL
- [ ] جميع ملفات Frontend مرفوعة على Bluehost
- [ ] `.htaccess` مرفوع على Bluehost
- [ ] SSL مفعّل على sakura.ai
- [ ] Stripe في Live Mode
- [ ] Stripe Webhook مضبوط
- [ ] Google OAuth redirect URI محدّث
- [ ] تجربة تسجيل دخول حقيقي
- [ ] تجربة الدفع عبر Stripe

---

## 🆘 حل المشاكل الشائعة

### مشكلة: CORS Error
**الحل:** تأكد أن `FRONTEND_URL=https://sakura.ai` في Railway Variables

### مشكلة: Database connection failed
**الحل:** تأكد أن `DATABASE_URL` يشير إلى PostgreSQL وليس SQLite

### مشكلة: Stripe webhook fails
**الحل:** تأكد أن `STRIPE_WEBHOOK_SECRET` صحيح في Railway Variables

### مشكلة: الصفحات تعطي 404 على Bluehost
**الحل:** تأكد أن `.htaccess` مرفوع في `public_html`

---

## 📞 الدعم

- Email: support@sakura.ai
- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Bluehost Support: [bluehost.com/help](https://www.bluehost.com/help)
