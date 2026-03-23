# Build and deploy CopilotSpeechNew sidecar (Windows SAPI engine)

Write-Host "Building CopilotSpeechNew sidecar..." -ForegroundColor Cyan

# Build project
Set-Location "CopilotSpeechNew"
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true

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
$grammarPublishPath = Join-Path $publishDir "grammar.xml"
$grammarProjectPath = "CopilotSpeechNew\grammar.xml"
$grammarLegacyPath = "CopilotSpeechNew\bin\Release\net8.0\grammar.xml"
$grammarFound = $null

if (Test-Path $grammarPublishPath) {
    $grammarFound = $grammarPublishPath
}
elseif (Test-Path $grammarProjectPath) {
    $grammarFound = $grammarProjectPath
}
elseif (Test-Path $grammarLegacyPath) {
    $grammarFound = $grammarLegacyPath
}

if ($grammarFound) {
    Copy-Item $grammarFound "$binDir\grammar.xml" -Force
    Write-Host "✓ Copied grammar.xml from $grammarFound" -ForegroundColor Green
}
else {
    Write-Host "✗ Warning: grammar.xml not found in publish or project paths" -ForegroundColor Yellow
}

Write-Host "`nSidecar build complete!" -ForegroundColor Green
Write-Host "Files are ready in: $binDir" -ForegroundColor Cyan
