# Scripts/build-speechtrainer.ps1
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')

$proj = Join-Path $repoRoot 'SpeechTrainer\SpeechTrainer.csproj'
if (-not (Test-Path $proj)) {
    Write-Error "Project not found: $proj"
    exit 1
}

Write-Output "Building SpeechTrainer project: $proj"

if (Get-Command msbuild -ErrorAction SilentlyContinue) {
    & msbuild $proj /p:Configuration=Release /t:Build
} elseif (Get-Command dotnet -ErrorAction SilentlyContinue) {
    & dotnet build $proj -c Release
} else {
    Write-Error "Neither msbuild nor dotnet CLI was found in PATH. Install MSBuild or .NET SDK."
    exit 1
}

Write-Output "Searching for built EXE..."
$buildBin = Join-Path $repoRoot 'SpeechTrainer\bin\Release'
$exeItem = Get-ChildItem -Path $buildBin -Recurse -Filter *.exe -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $exeItem) {
    Write-Error "Built EXE not found under $buildBin"
    exit 1
}

$targetDir = Join-Path $repoRoot 'src-tauri\Trainer'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Copy-Item -Path $exeItem.FullName -Destination (Join-Path $targetDir $exeItem.Name) -Force
Write-Output "Copied EXE: $($exeItem.FullName) -> $targetDir"

$txtSrc = Join-Path $repoRoot 'SpeechTrainer\training_phrases.txt'
if (Test-Path $txtSrc) {
    Copy-Item -Path $txtSrc -Destination (Join-Path $targetDir 'training_phrases.txt') -Force
    Write-Output "Copied training_phrases.txt -> $targetDir"
} else {
    Write-Output "No training_phrases.txt found in SpeechTrainer; skipping."
}

Write-Output "Done."
exit 0