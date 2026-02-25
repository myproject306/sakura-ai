$src = 'c:\Users\QATAR\Downloads\sakura-ai'
$dest = 'c:\Users\QATAR\Downloads\sakura-ai-frontend.zip'

if (Test-Path $dest) { Remove-Item $dest -Force }

$items = @(
  "$src\index.html",
  "$src\auth.html",
  "$src\dashboard.html",
  "$src\admin.html",
  "$src\tools.html",
  "$src\tool-interface.html",
  "$src\pricing.html",
  "$src\templates.html",
  "$src\contact.html",
  "$src\faq.html",
  "$src\privacy.html",
  "$src\terms.html",
  "$src\refund.html",
  "$src\checkout-success.html",
  "$src\offline.html",
  "$src\styles.css",
  "$src\script.js",
  "$src\sakura-assistant.js",
  "$src\sakura-assistant.css",
  "$src\config.js",
  "$src\manifest.json",
  "$src\sw.js",
  "$src\.htaccess",
  "$src\icons"
)

$existing = $items | Where-Object { Test-Path $_ }
Compress-Archive -Path $existing -DestinationPath $dest -Force
Write-Host "ZIP created: $dest"
Write-Host "Size: $([math]::Round((Get-Item $dest).Length / 1KB, 1)) KB"
