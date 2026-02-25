/* ============================================
   Sakura AI - Production Configuration
   ============================================
   
   SETUP INSTRUCTIONS:
   1. Deploy backend to Railway (railway.app)
   2. Replace BACKEND_URL below with your Railway URL
   3. Upload all files to Bluehost public_html
   ============================================ */

const SAKURA_CONFIG = {
  // ── Backend URL ──────────────────────────────
  // After deploying to Railway, replace this URL:
  // Example: 'https://sakura-ai-backend-production.up.railway.app'
  BACKEND_URL: 'https://YOUR-RAILWAY-APP.up.railway.app',

  // ── Demo Mode ────────────────────────────────
  // true  = fake auth (no backend needed) — for GitHub Pages
  // false = real auth (requires backend)  — for production
  IS_DEMO: false,

  // ── API Base URL (auto-computed) ─────────────
  get API_BASE() {
    if (window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    if (window.location.hostname.includes('github.io')) {
      return 'http://localhost:3001/api'; // demo mode — not used
    }
    return this.BACKEND_URL + '/api';
  },

  // ── Is Demo? (auto-computed) ─────────────────
  get DEMO_MODE() {
    if (this.IS_DEMO) return true;
    if (window.location.hostname.includes('github.io')) return true;
    // If backend URL is still a placeholder, use demo mode
    if (this.BACKEND_URL.includes('YOUR-RAILWAY-APP')) return true;
    return false;
  }
};
