# Build and deploy CopilotSpeechNew sidecar (Windows SAPI engine)

Write-Host "Building CopilotSpeechNew sidecar..." -ForegroundColor Cyan

# Build project
Set-Location "CopilotSpeechNew"
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Set-Location ".."

# Create the bin directory if it doesn't exist
$binDir = "src-tauri\bin"
if (!(Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

$publishDir = "CopilotSpeechNew\bin\Release\net8.0-windows\win-x64\publish"

# Copy executable
Write-Host "Copying .exe..." -ForegroundColor Yellow
Copy-Item "$publishDir\CopilotSpeech.exe" `
    "$binDir\copilot_speech-x86_64-pc-windows-msvc.exe" -Force
Write-Host "✓ Copied copilot_speech-x86_64-pc-windows-msvc.exe" -ForegroundColor Green

# Copy grammar file (required at runtime next to the exe)
Write-Host "Copying grammar.xml..." -ForegroundColor Yellow
$grammarSrc = "$publishDir\grammar.xml"
if (Test-Path $grammarSrc) {
    Copy-Item $grammarSrc "$binDir\grammar.xml" -Force
    Write-Host "✓ Copied grammar.xml" -ForegroundColor Green
}
else {
    Write-Host "✗ Warning: grammar.xml not found at $grammarSrc" -ForegroundColor Yellow
}

Write-Host "`nSidecar build complete!" -ForegroundColor Green
Write-Host "Files are ready in: $binDir" -ForegroundColor Cyan
