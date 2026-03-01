# Build and deploy CopilotSpeech sidecar

Write-Host "Building CopilotSpeech sidecar..." -ForegroundColor Cyan

# Build project
Set-Location "CopilotSpeech"
dotnet publish -c Release -r win-x64 --self-contained true

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

# Copy executable
Write-Host "Copying .exe..." -ForegroundColor Yellow
Copy-Item "CopilotSpeech\bin\Release\net8.0-windows\win-x64\publish\CopilotSpeech.exe" `
    "$binDir\copilot_speech-x86_64-pc-windows-msvc.exe" -Force

# Copy the DLLs from the project's runtimes directory
Write-Host "Copying DLLs..." -ForegroundColor Yellow
$sourceRuntimeDir = "CopilotSpeech\runtimes\win-x64\native"

if (Test-Path $sourceRuntimeDir) {
    $dllsToCopy = @(
        "libvosk.dll",
        "libgcc_s_seh-1.dll",
        "libstdc++-6.dll",
        "libwinpthread-1.dll"
    )

    foreach ($dll in $dllsToCopy) {
        $sourcePath = "$sourceRuntimeDir\$dll"
        $destPath = "$binDir\$dll"
        
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath $destPath -Force
            Write-Host "✓ Copied $dll" -ForegroundColor Green
        }
        else {
            Write-Host "✗ Warning: $dll not found at $sourcePath" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host "✗ Error: Runtime directory not found: $sourceRuntimeDir" -ForegroundColor Red
}

# Copy Silero VAD model
Write-Host "Copying Silero VAD model..." -ForegroundColor Yellow
$vadModelPath = "silero_vad_v4.onnx"

if (Test-Path $vadModelPath) {
    Copy-Item $vadModelPath "$binDir\silero_vad_v4.onnx" -Force
    Write-Host "✓ Copied silero_vad_v4.onnx" -ForegroundColor Green
}
else {
    Write-Host "✗ Warning: silero_vad_v4.onnx not found at $vadModelPath" -ForegroundColor Yellow
}

Write-Host "`nSidecar build complete!" -ForegroundColor Green
Write-Host "Files are ready in: $binDir" -ForegroundColor Cyan
Write-Host "`nNote: The .exe is self-contained, but native Vosk DLLs must be in the same directory." -ForegroundColor Gray
