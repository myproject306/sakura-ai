const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="100" fill="#fff0f5"/>
<defs>
<linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stop-color="#f7b7c8"/>
<stop offset="100%" stop-color="#e8547a"/>
</linearGradient>
<linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stop-color="#e8547a"/>
<stop offset="100%" stop-color="#c0392b"/>
</linearGradient>
</defs>
<ellipse cx="256" cy="160" rx="42" ry="72" fill="url(#g1)" transform="rotate(0 256 256)"/>
<ellipse cx="256" cy="160" rx="42" ry="72" fill="url(#g1)" transform="rotate(72 256 256)"/>
<ellipse cx="256" cy="160" rx="42" ry="72" fill="url(#g1)" transform="rotate(144 256 256)"/>
<ellipse cx="256" cy="160" rx="42" ry="72" fill="url(#g1)" transform="rotate(216 256 256)"/>
<ellipse cx="256" cy="160" rx="42" ry="72" fill="url(#g1)" transform="rotate(288 256 256)"/>
<circle cx="256" cy="256" r="52" fill="url(#g2)"/>
<text x="256" y="272" font-family="Arial,sans-serif" font-size="36" font-weight="900" fill="white" text-anchor="middle">AI</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svg, 'utf8');
console.log('icon.svg created');
console.log('Icons dir:', fs.readdirSync(iconsDir));
