using System.Speech.Recognition;
using System.Speech.Recognition.SrgsGrammar;
using System.Text.Json;
using VoiceSidecar;

// ─── Constants ────────────────────────────────────────────────────────────────

const float CONFIDENCE_THRESHOLD = 0.85f;
var confidenceThreshold = CONFIDENCE_THRESHOLD;

// Grammar path is passed as the first argument by the Tauri bridge so it resolves
// correctly in both dev (src-tauri/bin) and production (bundled resource dir).
var GRAMMAR_FILE =
    args.Length > 0 ? args[0] : Path.Combine(AppContext.BaseDirectory, "grammar.xml");

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Flush stdout immediately — Tauri reads line by line
Console.OutputEncoding = System.Text.Encoding.UTF8;

EmitStatus("starting");

if (!File.Exists(GRAMMAR_FILE))
{
    EmitError($"Grammar file not found: {Path.GetFullPath(GRAMMAR_FILE)}");
    Environment.Exit(1);
}

// ─── Engine setup ─────────────────────────────────────────────────────────────

// Prefer SR 8.0 explicitly. Fall back to any installed English recognizer.
// Emit which recognizer was selected so Tauri can surface it in the UI.
var recognizerInfo =
    SpeechRecognitionEngine
        .InstalledRecognizers()
        .FirstOrDefault((r) => r.Name.Contains("8.0") && r.Culture.TwoLetterISOLanguageName == "en")
    ?? SpeechRecognitionEngine
        .InstalledRecognizers()
        .FirstOrDefault((r) => r.Culture.TwoLetterISOLanguageName == "en");

if (recognizerInfo is null)
{
    EmitError(
        "No English speech recognizer found. Please install Microsoft Speech Recognizer 8.0."
    );
    Environment.Exit(1);
}

using var engine = new SpeechRecognitionEngine(recognizerInfo);

EmitStatus(
    "starting",
    new
    {
        recognizer = recognizerInfo.Name,
        recognizerId = recognizerInfo.Id,
        culture = recognizerInfo.Culture.Name,
    }
);

try
{
    engine.SetInputToDefaultAudioDevice();
}
catch (InvalidOperationException)
{
    EmitError("No default audio input device found.");
    Environment.Exit(1);
}

var srgs = new SrgsDocument(System.Xml.XmlReader.Create(File.OpenRead(GRAMMAR_FILE)));
var grammar = new Grammar(srgs);
engine.LoadGrammar(grammar);

// ─── Event handlers ───────────────────────────────────────────────────────────

engine.SpeechRecognized += (sender, e) =>
{
    if (e.Result.Confidence < confidenceThreshold)
    {
        EmitUnrecognized(e.Result.Text);
        return;
    }

    var sem = e.Result.Semantics;

    // Grammar guarantees these keys exist on every match
    if (!sem.ContainsKey("ActionRuleId") || !sem.ContainsKey("CmdId"))
    {
        EmitRejected(e.Result.Text, e.Result.Confidence, "missing_semantics");
        return;
    }

    var actionRuleId = sem["ActionRuleId"].Value?.ToString() ?? "";
    var cmdId = sem["CmdId"].Value?.ToString() ?? "";
    var cmdValue = sem.ContainsKey("CmdValue") ? sem["CmdValue"].Value?.ToString() ?? "" : "";

    var command = CommandDispatcher.Dispatch(actionRuleId, cmdId, cmdValue, e.Result.Text);

    if (command is null)
    {
        EmitRejected(e.Result.Text, e.Result.Confidence, "semantic_validation_failed");
        return;
    }

    EmitSpeech(command, e.Result.Confidence);
};

engine.SpeechRecognitionRejected += (sender, e) => {
    // Heard something but confidence was too low even
};

engine.RecognizeCompleted += (sender, e) =>
{
    if (e.Error is not null)
        EmitError(e.Error.Message);
};

// ─── Start ────────────────────────────────────────────────────────────────────

engine.RecognizeAsync(RecognizeMode.Multiple);
EmitStatus("ready");

// ─── Stdin config loop ────────────────────────────────────────────────────────
// Accepts: {"confidenceThreshold": 0.75}

var stdinThread = new Thread(() =>
{
    string? line;
    while ((line = Console.In.ReadLine()) is not null)
    {
        try
        {
            var doc = JsonDocument.Parse(line);
            if (doc.RootElement.TryGetProperty("confidenceThreshold", out var ct))
                confidenceThreshold = ct.GetSingle();
        }
        catch
        { /* ignore malformed input */
        }
    }
});
stdinThread.IsBackground = true;
stdinThread.Start();

// Keep process alive — Tauri sidecar owns the lifetime
Thread.Sleep(Timeout.Infinite);

// ─── Emit helpers ─────────────────────────────────────────────────────────────

static void EmitSpeech(VoiceCommand command, float confidence)
{
    // Detect pull vs set from the raw spoken text
    var isPull = command.Raw.StartsWith("pull ", StringComparison.OrdinalIgnoreCase);
    var verb = isPull ? "pull" : "set";

    // Reconstruct normalized text with correct verb so checklistRunner.ts still works
    var text = command.Type switch
    {
        "heading" when command.Payload.TryGetValue("value", out var v) => $"{verb} heading {v}",
        "altitude" when command.Payload.TryGetValue("flightLevel", out var fl) =>
            $"{verb} flight level {fl}",
        "altitude" when command.Payload.TryGetValue("value", out var v) => $"{verb} altitude {v}",
        "speed" when command.Payload.TryGetValue("value", out var v) => $"{verb} speed {v}",
        _ => command.Raw,
    };

    // Build enriched payload: original payload + verb for parametric commands
    Dictionary<string, object>? outPayload =
        command.Type is "heading" or "altitude" or "speed"
            ? new Dictionary<string, object>(command.Payload) { ["verb"] = verb }
        : command.Payload.Count > 0 ? command.Payload
        : null;

    WriteLine(
        outPayload is not null
            ? (object)
                new
                {
                    type = "speech",
                    commandType = command.Type,
                    payload = outPayload,
                    text,
                    confidence = Math.Round(confidence, 3),
                }
            : new
            {
                type = "speech",
                commandType = command.Type,
                text,
                confidence = Math.Round(confidence, 3),
            }
    );
}

static void EmitUnrecognized(string text)
{
    WriteLine(new { type = "speech_unrecognized", text });
}

static void EmitStatus(string status, object? details = null)
{
    WriteLine(
        details is not null
            ? (object)
                new
                {
                    type = "status",
                    status,
                    details,
                }
            : new { type = "status", status }
    );
}

static void EmitError(string message)
{
    WriteLine(new { type = "error", message });
}

static void EmitRejected(string text, float confidence, string reason = "low_confidence")
{
    // Only emit in debug builds to avoid noise in production
#if DEBUG
    WriteLine(
        new
        {
            type = "rejected",
            text,
            confidence = Math.Round(confidence, 3),
            reason,
        }
    );
#endif
}

static void WriteLine(object payload)
{
    Console.WriteLine(JsonSerializer.Serialize(payload));
    Console.Out.Flush();
}
