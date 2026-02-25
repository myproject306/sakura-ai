$src = "c:\Users\QATAR\Downloads\sakura-ai\backend"
$dst = "c:\Users\QATAR\Downloads\sakura-ai-backend-temp"
$out = "c:\Users\QATAR\Downloads\sakura-ai-backend.zip"

# Clean temp dir
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst | Out-Null

# Copy all backend files except node_modules and dev.db
$excludeDirs = @("node_modules", "logs")
$excludeFiles = @("dev.db", "*.log")

Get-ChildItem -Path $src | Where-Object {
    $_.Name -notin $excludeDirs
} | ForEach-Object {
    if ($_.PSIsContainer) {
        Copy-Item $_.FullName -Destination $dst -Recurse
    } else {
        Copy-Item $_.FullName -Destination $dst
    }
    Write-Host "Copied: $($_.Name)"
}

# Create ZIP
Compress-Archive -Path "$dst\*" -DestinationPath $out -Force
Write-Host "ZIP created: $out"

# Cleanup
Remove-Item $dst -Recurse -Force
Write-Host "Done! Backend ZIP ready for Railway deployment."
