# 🌸 دليل إعداد متغيرات البيئة على Railway

## كيفية إضافة المفاتيح على Railway

1. افتح **railway.app** → مشروعك
2. اضغط على **Variables** من القائمة الجانبية
3. أضف كل متغير بالاسم والقيمة

---

## 🤖 مزود الذكاء الاصطناعي (اختر واحداً)

### الخيار 1: Google Gemini REST API (مجاني ومتاح)
```
AI_PROVIDER = gemini
GEMINI_API_KEY = AIza...مفتاحك هنا
GEMINI_MODEL = gemini-1.5-pro
```
🔗 احصل على المفتاح: https://aistudio.google.com/app/apikey

### الخيار 1.5: Google Gemini Native (genai library) - مخفي
```
AI_PROVIDER = gemini-native
GOOGLE_API_KEY = AIza...مفتاحك هنا
GEMINI_NATIVE_MODEL = gemini-2.0-flash
```
🔗 احصل على المفتاح: https://aistudio.google.com/app/apikey
📌 يستخدم مكتبة `google.genai` مع `client.interactions.create()` - مدمج في المحرك المخفي



### الخيار 2: OpenAI (ChatGPT)
```
AI_PROVIDER = openai
OPENAI_API_KEY = sk-...مفتاحك هنا
OPENAI_MODEL_TEXT = gpt-4o
OPENAI_MODEL_CODE = gpt-4o
```
🔗 احصل على المفتاح: https://platform.openai.com/api-keys

### الخيار 3: Azure OpenAI (Copilot)
```
AI_PROVIDER = copilot
COPILOT_API_KEY = مفتاحك هنا
COPILOT_ENDPOINT = https://YOUR-RESOURCE.openai.azure.com
COPILOT_DEPLOYMENT = gpt-4o
COPILOT_API_VERSION = 2024-02-01
```

### الخيار 4: استخدام أكثر من مزود (الأقوى)
```
AI_PROVIDER = both
GEMINI_API_KEY = AIza...
OPENAI_API_KEY = sk-...
```

---

## 🔍 Bing Search (اختياري - يقوي نتائج البحث)
```
BING_SEARCH_API_KEY = مفتاحك هنا
```
🔗 احصل على المفتاح: https://portal.azure.com → Bing Search v7

---

## 🎨 الصور - Stability AI (اختياري)
```
STABILITY_API_KEY = sk-...مفتاحك هنا
```
🔗 احصل على المفتاح: https://platform.stability.ai/account/keys

---

## 🎧 الصوت - ElevenLabs (اختياري)
```
ELEVENLABS_API_KEY = مفتاحك هنا
ELEVENLABS_VOICE_ID_AR = صوت عربي
ELEVENLABS_VOICE_ID_EN = صوت إنجليزي
```
🔗 احصل على المفتاح: https://elevenlabs.io/app/settings/api-keys

---

## 💳 Stripe (للدفع)
```
STRIPE_SECRET_KEY = sk_live_...مفتاحك هنا
STRIPE_WEBHOOK_SECRET = whsec_...مفتاحك هنا
STRIPE_STARTER_PRICE_ID = price_...
STRIPE_PRO_PRICE_ID = price_...
STRIPE_TEAM_PRICE_ID = price_...
```
🔗 احصل على المفاتيح: https://dashboard.stripe.com/apikeys

---

## 🔐 الأمان والإعدادات الأساسية
```
NODE_ENV = production
PORT = 3001
JWT_SECRET = اكتب_كلمة_سر_عشوائية_طويلة_هنا
JWT_REFRESH_SECRET = اكتب_كلمة_سر_عشوائية_أخرى_هنا
FRONTEND_URL = https://sakura.ai
DATABASE_URL = postgresql://...رابط_قاعدة_البيانات
ADMIN_EMAIL = admin@sakura.ai
ADMIN_PASSWORD = كلمة_مرور_قوية_هنا
```

---

## ✅ الحد الأدنى للتشغيل

أقل شيء تحتاجه للبدء:
```
NODE_ENV = production
JWT_SECRET = (أي نص عشوائي طويل)
JWT_REFRESH_SECRET = (أي نص عشوائي طويل آخر)
FRONTEND_URL = https://sakura.ai
DATABASE_URL = (رابط PostgreSQL من Railway أو Supabase)
AI_PROVIDER = gemini
GEMINI_API_KEY = (مفتاح Gemini المجاني)
STRIPE_SECRET_KEY = (مفتاح Stripe)
STRIPE_WEBHOOK_SECRET = (مفتاح Webhook)
ADMIN_EMAIL = admin@sakura.ai
ADMIN_PASSWORD = (كلمة مرور قوية)
```

---

## 📝 ملاحظات مهمة

- **لا تشارك هذه المفاتيح مع أحد**
- **لا ترفع ملف .env على GitHub**
- بعد إضافة المتغيرات على Railway، اضغط **Deploy** لإعادة التشغيل
- للحصول على `DATABASE_URL` من Railway: أضف PostgreSQL plugin → انسخ الـ URL
