# 🌸 Sakura AI — API Test Commands (curl)

Run these after starting the backend: `npm run dev` (port 3001)

> **Windows users:** Replace `\` line continuations with `^`, or use Git Bash / WSL for the curl commands as-is.

---

## 0. Health Check

```bash
curl http://localhost:3001/api/health
```
**Expected:** `{"status":"ok","timestamp":"..."}`

---

## 1. Authentication

### 1.1 Register a new user
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```
**Expected:** `201` with `{ user: {...}, accessToken: "...", refreshToken: "..." }`

### 1.2 Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```
**Expected:** `200` with tokens. **Save the `accessToken` as `TOKEN` for subsequent tests.**

```bash
# Save token (bash)
TOKEN="paste_access_token_here"
```

### 1.3 Get current user (me)
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with user object

### 1.4 Duplicate email (should fail)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```
**Expected:** `409 { "error": "Email already registered" }`

### 1.5 Wrong password (should fail)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword!"
  }'
```
**Expected:** `401 { "error": "Invalid credentials" }`

### 1.6 Refresh token
```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "paste_refresh_token_here"}'
```
**Expected:** `200` with new `accessToken`

### 1.7 Update profile
```bash
curl -X PUT http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Updated", "lastName": "Name"}'
```
**Expected:** `200` with updated user

---

## 2. Stripe

### 2.1 Get prices (no auth required)
```bash
curl http://localhost:3001/api/stripe/prices
```
**Expected:** `200` with array of plans (fetched from Stripe or fallback static)

### 2.2 Create checkout session (requires auth + Stripe keys)
```bash
curl -X POST http://localhost:3001/api/stripe/create-checkout-session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_starter_id_from_stripe",
    "successUrl": "http://localhost:5500/sakura-ai/checkout-success.html",
    "cancelUrl": "http://localhost:5500/sakura-ai/pricing.html"
  }'
```
**Expected:** `200` with `{ url: "https://checkout.stripe.com/..." }`

### 2.3 Get subscription status
```bash
curl http://localhost:3001/api/stripe/subscription \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with subscription details (or `{ plan: "free" }` if no subscription)

### 2.4 Webhook test (simulate Stripe event)
```bash
# Note: Real webhooks require Stripe CLI for proper signature
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
# Then run: stripe listen --forward-to localhost:3001/api/stripe/webhook
# And trigger: stripe trigger checkout.session.completed
```

---

## 3. AI Tools

> **Note:** These require valid API keys in `.env` (OPENAI_API_KEY, STABILITY_API_KEY, ELEVENLABS_API_KEY)
> Also requires an active subscription (plan != 'free') unless you manually set plan in DB.

### 3.1 Run text tool — Article Writer
```bash
curl -X POST http://localhost:3001/api/tools/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "article-writer",
    "inputs": {
      "topic": "The future of AI in healthcare",
      "tone": "professional",
      "length": "medium",
      "language": "English"
    }
  }'
```
**Expected:** `200` with `{ result: "...", tokensUsed: N, projectId: "..." }`

### 3.2 Run text tool — Email Writer
```bash
curl -X POST http://localhost:3001/api/tools/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "email-writer",
    "inputs": {
      "purpose": "Follow up after a job interview",
      "tone": "professional",
      "recipient": "Hiring Manager",
      "language": "English"
    }
  }'
```
**Expected:** `200` with email content

### 3.3 Run text tool — Code Generator
```bash
curl -X POST http://localhost:3001/api/tools/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "code-generator",
    "inputs": {
      "description": "A Python function to sort a list of dictionaries by a key",
      "language": "Python",
      "framework": "None"
    }
  }'
```
**Expected:** `200` with code output

### 3.4 Run image tool — Text to Image (credits-based)
```bash
curl -X POST http://localhost:3001/api/tools/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "text-to-image",
    "inputs": {
      "prompt": "A beautiful sakura cherry blossom garden at sunset",
      "style": "photorealistic",
      "size": "1024x1024"
    }
  }'
```
**Expected:** `200` with `{ result: "https://...", creditsUsed: 1 }` or job ID if queued

### 3.5 Run audio tool — Text to Speech (credits-based)
```bash
curl -X POST http://localhost:3001/api/tools/run-audio \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "text-to-speech",
    "inputs": {
      "text": "Welcome to Sakura AI, your all-in-one AI platform.",
      "voice": "Rachel",
      "language": "English"
    }
  }'
```
**Expected:** `200` with audio URL or base64

### 3.6 Improve result
```bash
curl -X POST http://localhost:3001/api/tools/improve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "article-writer",
    "originalOutput": "AI is changing healthcare...",
    "instruction": "Make it more detailed and add statistics"
  }'
```
**Expected:** `200` with improved output

### 3.7 Regenerate result
```bash
curl -X POST http://localhost:3001/api/tools/regenerate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "article-writer",
    "inputs": {
      "topic": "The future of AI in healthcare",
      "tone": "casual",
      "length": "short",
      "language": "English"
    }
  }'
```
**Expected:** `200` with new output

### 3.8 Get usage stats
```bash
curl http://localhost:3001/api/tools/usage \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with `{ totalTokens, totalCredits, byTool: [...] }`

### 3.9 Unauthenticated tool call (should fail)
```bash
curl -X POST http://localhost:3001/api/tools/run \
  -H "Content-Type: application/json" \
  -d '{"toolId": "article-writer", "inputs": {}}'
```
**Expected:** `401 { "error": "No token provided" }`

---

## 4. Projects

### 4.1 Get all projects
```bash
curl http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with array of projects

### 4.2 Create a project manually
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Blog Post",
    "toolName": "article-writer",
    "category": "writing",
    "input": "{\"topic\": \"AI trends\"}",
    "output": "AI is transforming every industry..."
  }'
```
**Expected:** `201` with created project

### 4.3 Toggle favorite
```bash
# Replace PROJECT_ID with actual ID from step 4.2
curl -X POST http://localhost:3001/api/projects/PROJECT_ID/favorite \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with `{ isFavorite: true }`

### 4.4 Get favorites
```bash
curl http://localhost:3001/api/projects/favorites \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with favorited projects

### 4.5 Get project stats
```bash
curl http://localhost:3001/api/projects/stats \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200` with `{ total, favorites, byCategory: {...} }`

### 4.6 Delete a project
```bash
curl -X DELETE http://localhost:3001/api/projects/PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200 { "message": "Project deleted" }`

---

## 5. Admin Panel

> Requires admin role. Login with seeded admin: `admin@sakura.ai` / `Admin@Sakura2025!`

```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@sakura.ai", "password": "Admin@Sakura2025!"}'

# Save admin token
ADMIN_TOKEN="paste_admin_access_token_here"
```

### 5.1 Admin dashboard metrics
```bash
curl http://localhost:3001/api/admin/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with `{ totalUsers, activeSubscriptions, totalGenerations, revenue, ... }`

### 5.2 List all users
```bash
curl "http://localhost:3001/api/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with paginated user list

### 5.3 Update user plan
```bash
curl -X PUT http://localhost:3001/api/admin/users/USER_ID/plan \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "pro"}'
```
**Expected:** `200` with updated user

### 5.4 Get usage analytics
```bash
curl "http://localhost:3001/api/admin/usage?period=30d" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with usage breakdown by tool/category

### 5.5 Get error logs
```bash
curl "http://localhost:3001/api/admin/logs?severity=error&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with error log entries

### 5.6 Get revenue metrics
```bash
curl http://localhost:3001/api/admin/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with MRR, ARR, churn rate

### 5.7 Non-admin access (should fail)
```bash
curl http://localhost:3001/api/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `403 { "error": "Admin access required" }`

### 5.8 List templates
```bash
curl http://localhost:3001/api/admin/templates \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `200` with seeded templates

### 5.9 Create template
```bash
curl -X POST http://localhost:3001/api/admin/templates \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Launch Email",
    "category": "email",
    "emoji": "🚀",
    "description": "Announce a new product to your email list",
    "prompt": "Write a product launch email for {product_name} targeting {audience}"
  }'
```
**Expected:** `201` with created template

---

## 6. Rate Limiting Tests

### 6.1 Trigger rate limit (run 6+ times quickly)
```bash
for i in {1..7}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "wrong@test.com", "password": "wrong"}' \
    -w "\nStatus: %{http_code}\n"
done
```
**Expected:** First 5 return `401`, then `429 Too Many Requests`

---

## 7. Edge Cases

### 7.1 Invalid JSON body
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d 'not-valid-json'
```
**Expected:** `400` error

### 7.2 Missing required fields
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "incomplete@test.com"}'
```
**Expected:** `400` with validation errors array

### 7.3 Expired/invalid token
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer invalid.token.here"
```
**Expected:** `401 { "error": "Invalid token" }`

### 7.4 Tool with insufficient credits
```bash
# After depleting credits, image generation should fail
curl -X POST http://localhost:3001/api/tools/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolId": "text-to-image", "inputs": {"prompt": "test"}}'
```
**Expected:** `402 { "error": "Insufficient credits" }` (when credits = 0)

---

## ✅ Test Checklist

| Test | Endpoint | Expected |
|------|----------|----------|
| Health | GET /api/health | 200 ok |
| Register | POST /api/auth/register | 201 + tokens |
| Login | POST /api/auth/login | 200 + tokens |
| Me | GET /api/auth/me | 200 + user |
| Refresh | POST /api/auth/refresh | 200 + new token |
| Prices | GET /api/stripe/prices | 200 + plans |
| Checkout | POST /api/stripe/create-checkout-session | 200 + url |
| Run text tool | POST /api/tools/run | 200 + result |
| Run image tool | POST /api/tools/run | 200 + image |
| Run audio tool | POST /api/tools/run-audio | 200 + audio |
| Improve | POST /api/tools/improve | 200 + improved |
| Regenerate | POST /api/tools/regenerate | 200 + new result |
| Usage | GET /api/tools/usage | 200 + stats |
| Projects CRUD | GET/POST/DELETE /api/projects | 200/201/200 |
| Favorites | POST /api/projects/:id/favorite | 200 |
| Admin dashboard | GET /api/admin/dashboard | 200 + metrics |
| Admin users | GET /api/admin/users | 200 + list |
| Admin logs | GET /api/admin/logs | 200 + logs |
| Rate limit | POST /api/auth/login x7 | 429 on 6th+ |
| Unauth access | Any protected route | 401 |
| Non-admin admin | GET /api/admin/dashboard | 403 |
