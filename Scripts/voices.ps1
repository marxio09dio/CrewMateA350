# This script uses Azure Cognitive Services for high-quality TTS
# You'll need a free Azure account: https://azure.microsoft.com/free/

# === LOAD .env ===
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+)\s*$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}
else {
    Write-Error ".env file not found at: $envFile (copy .env.example and fill in your values)"
    exit 1
}

# === CONFIGURATION ===
$azureKey = $env:AZURE_TTS_KEY
$azureRegion = $env:AZURE_TTS_REGION
$voiceName = "en-US-JennyNeural"   # Jenny neural voice

# Other voices:
# "en-US-AriaNeural"  - Female, friendly
# "en-US-GuyNeural"   - Male, professional
# "en-US-DavisNeural" - Male, authoritative

$phrases = @{
    "clear_right"                               = "Clear right"
    "check"                                     = "Check"
    "ready"                                     = "Ready"
    "rotate"                                    = "Rotate"
    "100_knots"                                 = "One hundred knots"
    "70_knots"                                  = "Seventy knots"
    "positive_climb"                            = "Positive climb"
    "fl_100"                                    = "Flight level one hundred"
    "ten_thousand"                              = "Ten thousand"
    "transiton_altitude"                        = "Transition altitude"
    "transiton_level"                           = "Transition level"
    "spoilers"                                  = "Spoilers"
    "no_spoilers"                               = "No spoilers"
    "reverse_green"                             = "Reverse green"
    "no_reverse_engine_1_and_2"                 = "No reverse engine one and two"
    "decel"                                     = "Deecel"
    "check_speed"                               = "Check speed"
    "speed_checked"                             = "Speed checked"
    "gear_down"                                 = "Gear down"
    "gear_up"                                   = "Gear up"
    "exterior_lights"                           = "Exterior lights"
    "ground_servicing"                          = "Ground servicing"
    "external_power"                            = "External power"
    "efbs"                                      = "EFBs"
    "batteries"                                 = "Batteries"
    "securing_the_aircraft_checklist_completed" = "Securing the aircraft checklist completed"
    "parking_brake_or_chocks"                   = "Parking brake or chocks"
    "wing_lights"                               = "Wing lights"
    "parking_checklist_completed"               = "Parking checklist completed"
    "landing_checklist_completed"               = "Landing checklist completed"
    "baro_ref"                                  = "Baro ref"
    "minimum"                                   = "Minimum"
    "runway_condition"                          = "Runway condition"
    "auto_brake"                                = "Auto brake"
    "approach_checklist_completed"              = "Approach checklist completed"
    "cabin_crew"                                = "Cabin crew"
    "takeoff_runway"                            = "Takeoff runway"
    "packs_one_and_two"                         = "Packs one and two"
    "line_up_checklist_completed"               = "Line up checklist completed"
    "flap_settings"                             = "Flap settings"
    "radar"                                     = "Radar"
    "taxi_checklist_completed"                  = "Taxi checklist completed"
    "anti_ice"                                  = "Anti ice"
    "flight_controls"                           = "Flight controls"
    "ground_clearance"                          = "Ground clearance"
    "after_start_checklist_completed"           = "After start checklist completed"
    "parking_brake"                             = "Parking brake"
    "takeoff_speeds_and_thrust"                 = "Takeoff speeds and thrust"
    "slides"                                    = "Slides"
    "nws_disc_memo"                             = "nose wheel steering disconnect memo"
    "before_start_checklist_completed"          = "Before start checklist completed"
    "gear_pins_and_covers"                      = "Gear pins and covers"
    "fuel_quantity"                             = "Fuel quantity"
    "cockpit_preparation_checklist_completed"   = "Cockpit preparation checklist completed"
    "full_left"                                 = "Full left"
    "full_right"                                = "Full right"
    "full_up"                                   = "Full up"
    "full_down"                                 = "Full down"
    "neutral"                                   = "Neutral"
    "flaps_0"                                   = "Flaps zero"
    "flaps_1"                                   = "Flaps one"
    "flaps_2"                                   = "Flaps two"
    "flaps_3"                                   = "Flaps three"
    "flaps_full"                                = "Flaps full"
    "config_1_plus_f"                           = "Config one plus f"
    "config_2"                                  = "Config two"
    "walkaround"                                = "I'll perform the walkaround now"
    "walkaround_completed"                      = "Walkaround completed, all good no issues found"
    "0"                                         = "Zero"
    "1"                                         = "One"
    "2"                                         = "Two"
    "3"                                         = "Three"
    "4"                                         = "Four"
    "5"                                         = "Five"
    "6"                                         = "Six"
    "7"                                         = "Seven"
    "8"                                         = "Eight"
    "9"                                         = "Niner"
    "Ok"                                        = "Ok"
    "v_one"                                     = "V one"
    "v_r"                                       = "V r"
    "v_2"                                       = "V two"
    "fire_test"                                 = "Fire test"
    "thousand"                                  = "Thousand"
    "tons"                                      = "Tons"
    "point"                                     = "Point"
    "set"                                       = "Set"
    "TOGA"                                      = "Toga"
    "flex"                                      = "Flex"
    "confirmed"                                 = "Confirmed"
    "BTV"                                       = "BTV"
    "check_seatbelts"                           = "Check seatbelts"
    "check_landing_gear"                        = "Check landing gear"
    "check_flaps"                               = "Check flaps"
    "check_spoilers"                            = "Check spoilers"
    "cabin_takeoff"                             = "Cabin crew, please be seated for takeoff"
    "cabin_landing"                             = "Cabin crew, please be seated for landing"
}

# Derive folder name from voice: "en-US-JennyNeural" -> "Jenny"
$voiceShortName = ($voiceName -replace '^.*-([A-Za-z]+)Neural$', '$1')
if ([string]::IsNullOrWhiteSpace($voiceShortName) -or $voiceShortName -eq $voiceName) {
    $voiceShortName = $voiceName  # fallback to full name
}
$outDir = Join-Path $PSScriptRoot "..\src-tauri\sounds\$voiceShortName"
$outDir = [System.IO.Path]::GetFullPath($outDir)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ffmpegExe = "C:\Users\extra\Downloads\Wwise-Unpacker-master\Tools\ffmpeg.exe"

if (-not (Test-Path $ffmpegExe)) {
    Write-Error "FFmpeg not found at: $ffmpegExe"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($azureKey) -or $azureKey -eq "your_azure_tts_key_here") {
    Write-Error "Please set AZURE_TTS_KEY in PSscripts/.env"
    Write-Host ""
    Write-Host "To get a free Azure key:"
    Write-Host "1. Go to https://azure.microsoft.com/free/"
    Write-Host "2. Create a free account"
    Write-Host "3. Create a Speech Service resource"
    Write-Host "4. Copy the key and region"
    exit 1
}

$count = 0
$total = $phrases.Count

Write-Host "Using Azure TTS with voice: $voiceName"
Write-Host ""

foreach ($file in $phrases.Keys) {
    $count++
    $text = $phrases[$file]
    $mp3Path = "$outDir\$file.mp3"
    $oggPath = "$outDir\$file.ogg"

    Write-Host "[$count/$total] Processing: $file"

    try {
        # Build SSML
        $ssml = @"
<speak version='1.0' xml:lang='en-US'>
    <voice name='$voiceName'>
        <prosody rate='-5%' pitch='+0%'>
            $text
        </prosody>
    </voice>
</speak>
"@

        # Call Azure TTS API
        $headers = @{
            "Ocp-Apim-Subscription-Key" = $azureKey
            "Content-Type"              = "application/ssml+xml"
            "X-Microsoft-OutputFormat"  = "audio-16khz-128kbitrate-mono-mp3"
        }

        $uri = "https://$azureRegion.tts.speech.microsoft.com/cognitiveservices/v1"
        
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $ssml -OutFile $mp3Path
        
        # Convert to OGG
        $ffmpegArgs = "-i `"$mp3Path`" -c:a libvorbis -q:a 4 `"$oggPath`" -y"
        $process = Start-Process -FilePath $ffmpegExe -ArgumentList $ffmpegArgs -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            Remove-Item $mp3Path -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Error "Error processing $file : $_"
    }
}

Write-Host ""
Write-Host "✓ Completed! Audio files created in $outDir"