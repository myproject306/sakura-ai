# 🌸 Sakura AI — Production Platform

All AI Tools. One Beautiful Platform.

---

## 📁 Project Structure

```
sakura-ai/
├── index.html              ← Homepage (production)
├── auth.html               ← Sign Up / Log In (Email + Google OAuth)
├── pricing.html            ← Pricing (fetches live from Stripe)
├── tools.html              ← AI Tools catalog
├── tool-interface.html     ← Universal tool interface (real AI)
├── dashboard.html          ← User dashboard (API-driven)
├── checkout-success.html   ← Post-Stripe checkout page
├── admin.html              ← Admin panel
├── templates.html          ← Templates library
├── contact.html            ← Contact page
├── faq.html                ← FAQ
├── privacy.html            ← Privacy Policy
├── terms.html              ← Terms & Conditions
├── refund.html             ← Refund Policy
├── styles.css              ← Shared stylesheet (Sakura theme)
├── script.js               ← Shared JavaScript
└── backend/
    ├── server.js           ← Express server
    ├── package.json        ← Dependencies
    ├── .env.example        ← Environment variables template
    ├── setup.bat           ← Windows setup script
    ├── prisma/
    │   ├── schema.prisma   ← Database schema (SQLite/PostgreSQL)
    │   └── seed.js         ← Database seeder
    ├── routes/
    │   ├── auth.js         ← Auth (register, login, Google OAuth)
    │   ├── stripe.js       ← Stripe (checkout, webhooks, portal)
    │   ├── tools.js        ← AI Tool Router
    │   ├── projects.js     ← User projects & saved results
    │   └── admin.js        ← Admin panel API
    ├── middleware/
    │   ├── auth.js         ← JWT verification
    │   └── rateLimit.js    ← Rate limiting & usage tracking
    └── services/
        ├── toolRouter.js   ← AI provider dispatch
        └── queue.js        ← Job queue (Bull/Redis or in-memory)
```

---

## 🚀 Quick Start

### Step 1: Install Node.js
Download from **https://nodejs.org** — choose LTS version (18.x or higher)

### Step 2: Run Setup Script (Windows)
```bash
cd sakura-ai/backend
setup.bat
```

Or manually:
```bash
cd sakura-ai/backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```
Edit `.env` with your API keys (see Configuration section below).

### Step 4: Start Backend
```bash
cd sakura-ai/backend
npm run dev
```
Backend runs on **http://localhost:3001**

### Step 5: Open Frontend
Open `sakura-ai/index.html` in browser, or use VS Code Live Server on port 5500.

---

## ⚙️ Configuration (.env)

### Required Keys

| Variable | Where to Get |
|----------|-------------|
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Generate: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | Same as above |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Add endpoint |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `STABILITY_API_KEY` | [Stability AI](https://platform.stability.ai) |
| `ELEVENLABS_API_KEY` | [ElevenLabs](https://elevenlabs.io) |
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Same as above |

### Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) (use **Test Mode**)
2. Create 3 Products:
   - **Starter** — $9/month recurring
   - **Pro** — $29/month recurring  
   - **Team** — $79/month recurring
3. Copy each Price ID to `.env`:
   ```
   STRIPE_STARTER_PRICE_ID=price_xxx
   STRIPE_PRO_PRICE_ID=price_xxx
   STRIPE_TEAM_PRICE_ID=price_xxx
   ```
4. Add Webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
5. Subscribe to events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `customer.subscription.trial_will_end`

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Secret to `.env`

---

## 🤖 AI Tools Architecture

### Text & Code Tools (OpenAI GPT-4)
- Article Writer, Email Writer, Social Media Posts
- Text Summarizer, Text Rewriter, Marketing Copy
- Code Generator, Bug Fixer, Code Explainer
- Business Plan, CV Writer, Study Plan, etc.

### Image Tools (Stability AI)
- Text to Image (SDXL 1.0)
- Logo Generator, Social Media Designer
- Poster Maker, Background Remover

### Audio Tools (ElevenLabs)
- Text to Speech (Arabic & English)
- Voice-Over Generator

### Usage Model
| Tool Type | Billing |
|-----------|---------|
| Text/Code/Data/Study/Business | Token-based (Fair-Use monthly limit) |
| Image/Audio | Credits-based (per generation) |

---

## 💳 Subscription Plans

| Plan | Price | Tokens/mo | Credits/mo |
|------|-------|-----------|------------|
| Starter | $9/mo | 500K | 50 |
| Pro | $29/mo | 2M | 200 |
| Team | $79/mo | 10M | 1,000 |

---

## 🔐 Security

- JWT tokens (access + refresh)
- Passwords hashed with bcrypt (12 rounds)
- Stripe handles all payment data (PCI compliant)
- API keys stored server-side only
- Rate limiting per user per endpoint
- Input validation with express-validator
- CORS configured for frontend origin only

---

## 📊 Admin Panel

Access at `/admin.html` — requires admin role.

Features:
- Dashboard metrics (users, subscriptions, generations)
- User management (view, edit plan, delete)
- Usage analytics by tool and category
- Error logs with severity filtering
- Template management (CRUD)
- Revenue metrics (MRR/ARR from Stripe)
- Queue status

Default admin credentials (after seeding):
- Email: `admin@sakura.ai`
- Password: `Admin@Sakura2025!`

**Change these immediately in production!**

---

## 🌐 Production Deployment

### Environment
1. Set `NODE_ENV=production` in `.env`
2. Use PostgreSQL: `DATABASE_URL="postgresql://..."`
3. Set `FRONTEND_URL` to your domain
4. Use live Stripe keys (not test keys)
5. Set up Redis for Bull queue: `REDIS_URL=redis://...`

### Recommended Stack
- **Backend**: Node.js on Railway, Render, or DigitalOcean
- **Database**: PostgreSQL on Supabase or Railway
- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Redis**: Upstash Redis (free tier available)

### Go-Live Checklist
- [ ] Switch Stripe to Live Mode
- [ ] Configure live webhook endpoint
- [ ] Set strong JWT secrets
- [ ] Enable HTTPS
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Test all subscription flows end-to-end
- [ ] Verify webhook events are received
- [ ] Test tool execution with real API keys
- [ ] Privacy Policy, Terms, Refund Policy linked in footer ✅

---

## 📞 Support

- Email: hello@sakura.ai
- Support Hours: Mon–Fri, 9AM–6PM (GMT+3)
