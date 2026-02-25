$src = "c:\Users\QATAR\Downloads\sakura-ai"
$dst = "c:\Users\QATAR\Downloads\sakura-ai-frontend-temp"
$out = "c:\Users\QATAR\Downloads\sakura-ai-frontend.zip"

# Clean temp dir
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst | Out-Null

# Frontend files to include
$files = @(
    "index.html",
    "auth.html",
    "dashboard.html",
    "admin.html",
    "tool-interface.html",
    "tools.html",
    "pricing.html",
    "checkout-success.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "refund.html",
    "faq.html",
    "templates.html",
    "offline.html",
    "styles.css",
    "script.js",
    "config.js",
    "manifest.json",
    "sw.js",
    "sakura-assistant.js",
    "sakura-assistant.css",
    ".htaccess"
)

foreach ($f in $files) {
    $s = Join-Path $src $f
    if (Test-Path $s) {
        Copy-Item $s $dst
        Write-Host "Copied: $f"
    } else {
        Write-Host "Not found: $f"
    }
}

# Copy icons folder
$iconsDir = Join-Path $src "icons"
if (Test-Path $iconsDir) {
    Copy-Item $iconsDir $dst -Recurse
    Write-Host "Copied: icons/"
}

# Create ZIP
Compress-Archive -Path "$dst\*" -DestinationPath $out -Force
Write-Host "ZIP created: $out"

# Cleanup
Remove-Item $dst -Recurse -Force
Write-Host "Done! Frontend ZIP ready for Bluehost upload."
