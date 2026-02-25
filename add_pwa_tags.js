const fs = require('fs');
const path = require('path');

const dir = __dirname;

// HTML files to update (excluding index.html which is already done)
const files = [
  'auth.html',
  'pricing.html',
  'tools.html',
  'tool-interface.html',
  'dashboard.html',
  'checkout-success.html',
  'admin.html',
  'templates.html',
  'faq.html',
  'contact.html',
  'privacy.html',
  'terms.html',
  'refund.html',
  'offline.html',
];

const PWA_META = `  <!-- PWA -->
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#e8547a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Sakura AI" />
  <link rel="apple-touch-icon" href="icons/icon.svg" />`;

const SW_SCRIPT = `<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('🌸 SW registered'))
        .catch(err => console.warn('SW registration failed:', err));
    });
  }
</script>`;

let updated = 0;
let skipped = 0;

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped (not found): ${file}`);
    skipped++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has PWA manifest
  if (content.includes('rel="manifest"')) {
    console.log(`✓  Already has PWA: ${file}`);
    skipped++;
    return;
  }

  // Add PWA meta tags before </head>
  if (content.includes('</head>')) {
    content = content.replace('</head>', PWA_META + '\n</head>');
  }

  // Add SW registration before first <script src= or before </body>
  if (!content.includes("serviceWorker")) {
    if (content.includes('<script src=')) {
      content = content.replace('<script src=', SW_SCRIPT + '\n<script src=');
    } else if (content.includes('</body>')) {
      content = content.replace('</body>', SW_SCRIPT + '\n</body>');
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${file}`);
  updated++;
});

console.log(`\n🌸 Done! Updated: ${updated}, Skipped: ${skipped}`);
