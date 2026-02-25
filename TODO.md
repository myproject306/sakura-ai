# TODO - Sakura AI Production Deployment

## ✅ مكتمل — تحديث الدومين (sakura-ai.com → sakura.ai)

- [x] 1. Update `backend/server.js` - Add sakura.ai to CORS origins
- [x] 2. Create `backend/.env` - Set FRONTEND_URL=https://sakura.ai
- [x] 3. Update `contact.html` - Change email to support@sakura.ai
- [x] 4. Update `privacy.html` - Change domain & email references
- [x] 5. Update `terms.html` - Change domain & email references
- [x] 6. Update `refund.html` - Change domain & email references
- [x] 7. Update `backend/prisma/seed.js` - admin@sakura.ai
- [x] 8. Update `README.md` - hello@sakura.ai + admin@sakura.ai
- [x] 9. Update `backend/API_TESTS.md` - admin@sakura.ai

## ✅ مكتمل — إعداد النشر

- [x] 10. Create `config.js` - Centralized API config (Railway URL placeholder)
- [x] 11. Update all HTML files to use `SAKURA_CONFIG.API_BASE`
- [x] 12. Create `backend/railway.json` - Railway deployment config
- [x] 13. Update `backend/package.json` - Add postinstall + build scripts
- [x] 14. Create `.htaccess` - Bluehost SPA routing + security headers
- [x] 15. Create `DEPLOY.md` - Full deployment guide

## ✅ مكتمل — تحديثات المساعد الذكي (ساكورا)

- [x] 25. Disable TTS auto-voice — unreliable across browsers/OS
- [x] 26. FAB button hidden on load, appears after 1.5s delay
- [x] 27. Panel only opens on user click (like ChatGPT/Copilot/Gemini)
- [x] 28. Mic button (STT) still works for voice INPUT only

## 🔲 متبقي — يحتاج تدخل يدوي

- [ ] 16. Deploy backend to Railway → get URL
- [ ] 17. Update `config.js` BACKEND_URL with Railway URL
- [ ] 18. Change `prisma/schema.prisma` provider to `postgresql` (for Railway)
- [ ] 19. Add all environment variables on Railway dashboard
- [ ] 20. Run `node prisma/seed.js` on Railway shell
- [ ] 21. Upload frontend files to Bluehost public_html
- [ ] 22. Enable SSL on Bluehost (Let's Encrypt)
- [ ] 23. Configure Stripe webhook URL
- [ ] 24. Update Google OAuth redirect URI

## 📖 راجع DEPLOY.md للتعليمات الكاملة
