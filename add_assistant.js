const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = [
  'index.html','auth.html','pricing.html','tools.html','tool-interface.html',
  'dashboard.html','checkout-success.html','admin.html','templates.html',
  'faq.html','contact.html','privacy.html','terms.html','refund.html','offline.html'
];

const SCRIPT = '<script src="sakura-assistant.js"></script>';
let updated = 0;

files.forEach(file => {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) { console.log('Not found: ' + file); return; }
  let c = fs.readFileSync(fp, 'utf8');
  if (c.includes('sakura-assistant.js')) { console.log('Already has: ' + file); return; }
  // Insert before </body>
  c = c.replace('</body>', SCRIPT + '\n</body>');
  fs.writeFileSync(fp, c, 'utf8');
  console.log('Updated: ' + file);
  updated++;
});

console.log('\nDone! Updated: ' + updated + ' files');
