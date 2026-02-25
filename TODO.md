# Sakura AI — Production Build Checklist

## ✅ Phase 1: Core Platform (COMPLETE)
- [x] styles.css
- [x] script.js
- [x] index.html
- [x] tools.html
- [x] templates.html
- [x] dashboard.html
- [x] faq.html
- [x] contact.html
- [x] pricing.html
- [x] privacy.html
- [x] terms.html
- [x] refund.html

## ✅ Phase 2: Production Platform (COMPLETE)

### Backend — sakura-ai/backend/
- [x] package.json
- [x] server.js
- [x] .env.example
- [x] prisma/schema.prisma
- [x] prisma/seed.js
- [x] middleware/auth.js
- [x] middleware/rateLimit.js
- [x] routes/auth.js
- [x] routes/stripe.js
- [x] routes/tools.js
- [x] routes/projects.js
- [x] routes/admin.js
- [x] services/toolRouter.js
- [x] services/queue.js
- [x] setup.bat (Windows quick-start script)
- [x] API_TESTS.md

### Frontend — New Pages
- [x] auth.html (Sign Up / Log In + Google OAuth)
- [x] tool-interface.html (Generic tool interface)
- [x] checkout-success.html (Post-Stripe redirect)
- [x] admin.html (Admin panel)

### Frontend — Updated Pages
- [x] index.html (Demo mode removed, production CTAs)
- [x] pricing.html (Stripe API price fetching)
- [x] dashboard.html (Real API-driven dashboard + usage meter)
- [x] tools.html (Production tool catalog, no demo banner)
- [x] templates.html (All 18 cards, auth.html redirects, no modals)
- [x] faq.html (Subscription model FAQ, Pricing in nav, no modals)
- [x] contact.html (WhatsApp removed, Pricing in nav, no modals)
- [x] privacy.html (Pricing in nav, no modals)
- [x] terms.html (Subscription model description, Pricing in nav, no modals)
- [x] refund.html (Subscription model content, Pricing in nav, no modals)
- [x] styles.css (Tool interface, admin, auth, usage meter styles)
- [x] script.js (JWT auth state, API calls, Stripe.js)
- [x] README.md

## ✅ Phase 3: Testing (COMPLETE)
- [x] index.html — Production nav, no demo banner, correct CTAs ✅
- [x] auth.html — Login/Create Account tabs, Google OAuth button ✅
- [x] pricing.html — All 3 plans ($9/$29/$79), features, "Start 7-Day Free Trial" ✅
- [x] tools.html — Tool catalog, "Try Now" → auth.html for logged-out users ✅
- [x] templates.html — 18 cards, category filters, useTemplate() auth check ✅
- [x] faq.html — Subscription FAQ, Pricing in nav, footer Pricing link ✅
- [x] contact.html — WhatsApp removed, Pricing in nav, auth check ✅
- [x] privacy.html — Production nav with Pricing, legal content ✅
- [x] refund.html — Subscription-based content, Pricing in nav ✅
- [x] dashboard.html — Auth guard → redirects to login ✅
- [x] tool-interface.html — Auth guard → redirects to login ✅
- [x] checkout-success.html — Auth guard → redirects to login ✅
- [x] admin.html — Auth guard → redirects to login ✅
- [x] No old loginModal/signupModal HTML anywhere ✅
- [x] All 9 public pages have id="navActions" ✅
- [x] All footers include Pricing link ✅

## 🚀 Phase 4: Go-Live Checklist

### Stripe Setup
- [ ] Create Stripe account and products (Starter $9, Pro $29, Team $79)
- [ ] Copy price IDs to backend/.env
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Test checkout flow in Stripe Test Mode

### Backend Deployment
- [ ] Deploy backend to Railway / Render / Fly.io
- [ ] Set all environment variables in deployment platform
- [ ] Run `prisma migrate deploy` on production DB
- [ ] Update SAKURA_API in script.js to production backend URL

### AI Provider Setup
- [ ] Add OpenAI API key to .env
- [ ] Add Stability AI API key to .env
- [ ] Add ElevenLabs API key to .env

### Google OAuth Setup
- [ ] Create Google Cloud project
- [ ] Enable Google OAuth 2.0
- [ ] Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env

### Final Checks
- [ ] Privacy Policy, Terms, Refund Policy linked in footer ✅
- [ ] No "Coming Soon" tools visible on production
- [ ] Stripe webhooks live and tested
- [ ] Monitoring enabled
- [ ] End-to-end test: Signup → Checkout → Dashboard → Tool → Save

## Brand
- Primary: #F7B7C8 (Sakura Pink)
- Secondary: #FADADD (Soft Rose)
- Background: #FFFFFF
- Accent: #F5F5F5
- Font: Poppins
- Style: Japanese minimalism
- Plans: Starter $9 / Pro $29 / Team $79 (Early Access)
- DB: SQLite (dev) + PostgreSQL (prod) via Prisma
- AI: OpenAI (text/code), Stability AI (images), ElevenLabs (audio)
- Live URL: https://myproject306.github.io/sakura-ai
