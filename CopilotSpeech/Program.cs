using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using NAudio.Wave;
using Vosk;

class Program
{
    private const int SampleRate = 16000;

    // Silero VAD
    private const float VadThreshold = 0.08f;
    private const int VadSampleRate = 16000;
    private const int VadWindowSize = 512;
    private const int MaxSilenceFrames = 30;

    // Audio gain applied to mic input before VAD + recognition (1.0 = no boost)
    private static float AudioGain = 1.8f;

    // Ring buffer keeps the last N frames so word onsets aren't clipped
    private const int PreBufferFrames = 5;
    private static readonly Queue<float[]> preBuffer = new();

    private static InferenceSession? vadSession;
    private static Tensor<float> vadH = new DenseTensor<float>(new[] { 2, 1, 64 });
    private static Tensor<float> vadC = new DenseTensor<float>(new[] { 2, 1, 64 });

    private static readonly List<float> audioBuffer = new();
    private static bool isSpeaking = false;
    private static int silenceFrames = 0;

    private static readonly HashSet<string> ValidCommands = new HashSet<string>(
        GetValidCommands().Concat(GetDigitCommands(4))
    );

    static void Main(string[] args)
    {
        Console.Error.WriteLine("Vosk speech sidecar starting…");
        Vosk.Vosk.SetLogLevel(0);

        if (args.Length == 0)
        {
            Console.Error.WriteLine("Usage: CopilotSpeech.exe <vosk-model-path>");
            Environment.Exit(1);
        }

        var modelPath = args[0];
        if (!Directory.Exists(modelPath))
        {
            Console.Error.WriteLine($"Vosk model not found: {modelPath}");
            Environment.Exit(1);
        }

        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var vadModelPath = Path.Combine(exeDir, "silero_vad_v4.onnx");

        if (File.Exists(vadModelPath))
        {
            vadSession = new InferenceSession(vadModelPath);
            Console.Error.WriteLine("Silero VAD loaded");
        }
        else
        {
            Console.Error.WriteLine("Silero VAD not found — running without VAD");
        }

        var model = new Model(modelPath);
        var grammarJson = JsonSerializer.Serialize(ValidCommands);
        var recognizer = new VoskRecognizer(model, SampleRate, grammarJson);

        using var mic = new WaveInEvent
        {
            WaveFormat = new WaveFormat(SampleRate, 1),
            BufferMilliseconds = 50,
        };

        mic.DataAvailable += (_, e) =>
        {
            if (vadSession != null)
                ProcessAudioWithVAD(e.Buffer, e.BytesRecorded, recognizer);
            else if (recognizer.AcceptWaveform(e.Buffer, e.BytesRecorded))
                HandleFinalResult(recognizer.Result());
        };

        mic.StartRecording();
        Console.Error.WriteLine("Sidecar ready.");

        // Listen for config updates on stdin (JSON lines)
        while (true)
        {
            var line = Console.ReadLine();
            if (line == null)
                break;

            try
            {
                using var doc = JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("gain", out var gainProp))
                {
                    AudioGain = gainProp.GetSingle();
                    Console.Error.WriteLine($"[CONFIG] Audio gain set to {AudioGain:F2}");
                }
            }
            catch
            {
                // ignore malformed input
            }
        }
    }

    static void ProcessAudioWithVAD(byte[] buffer, int bytesRecorded, VoskRecognizer recognizer)
    {
        var samples = new float[bytesRecorded / 2];
        for (int i = 0; i < samples.Length; i++)
        {
            short s = BitConverter.ToInt16(buffer, i * 2);
            samples[i] = Math.Clamp((s / 32768f) * AudioGain, -1f, 1f);
        }

        for (int i = 0; i + VadWindowSize <= samples.Length; i += VadWindowSize)
        {
            var chunk = samples.Skip(i).Take(VadWindowSize).ToArray();
            float prob = RunVAD(chunk);

            if (prob > VadThreshold)
            {
                if (!isSpeaking)
                {
                    isSpeaking = true;
                    audioBuffer.Clear();
                    silenceFrames = 0;

                    // Prepend pre-buffer so the word onset is captured
                    foreach (var prev in preBuffer)
                        audioBuffer.AddRange(prev);
                    preBuffer.Clear();
                }

                audioBuffer.AddRange(chunk);
            }
            else if (isSpeaking)
            {
                silenceFrames++;

                if (silenceFrames < 5)
                    audioBuffer.AddRange(chunk);

                if (silenceFrames >= MaxSilenceFrames)
                    EndSpeech(recognizer);
            }
            else
            {
                // Not speaking — maintain rolling pre-buffer
                preBuffer.Enqueue((float[])chunk.Clone());
                if (preBuffer.Count > PreBufferFrames)
                    preBuffer.Dequeue();
            }
        }
    }

    static void EndSpeech(VoskRecognizer recognizer)
    {
        if (audioBuffer.Count == 0)
            return;

        var audioBytes = new byte[audioBuffer.Count * 2];
        for (int i = 0; i < audioBuffer.Count; i++)
        {
            short s = (short)(audioBuffer[i] * 32767f);
            BitConverter.GetBytes(s).CopyTo(audioBytes, i * 2);
        }

        recognizer.AcceptWaveform(audioBytes, audioBytes.Length);
        HandleFinalResult(recognizer.FinalResult());
        recognizer.Reset();

        audioBuffer.Clear();
        isSpeaking = false;
        silenceFrames = 0;
    }

    static float RunVAD(float[] samples)
    {
        if (vadSession == null)
            return 0f;

        var input = new DenseTensor<float>(new[] { 1, VadWindowSize });
        for (int i = 0; i < VadWindowSize; i++)
            input[0, i] = samples[i];

        var sr = new DenseTensor<long>(new[] { 1 });
        sr[0] = VadSampleRate;

        using var results = vadSession.Run(
            new[]
            {
                NamedOnnxValue.CreateFromTensor("input", input),
                NamedOnnxValue.CreateFromTensor("h", vadH),
                NamedOnnxValue.CreateFromTensor("c", vadC),
                NamedOnnxValue.CreateFromTensor("sr", sr),
            }
        );

        vadH = results.First(r => r.Name == "h").AsTensor<float>();
        vadC = results.First(r => r.Name == "c").AsTensor<float>();

        return results.First(r => r.Name == "output").AsEnumerable<float>().First();
    }

    static void HandleFinalResult(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("text", out var textProp))
            return;

        var text = textProp.GetString()?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(text))
            return;

        // NORMALIZE FIRST
        text = NormalizeCommand(text);

        // THEN VALIDATE
        if (!IsValidCommand(text))
            return;

        Console.WriteLine(
            JsonSerializer.Serialize(
                new
                {
                    type = "speech",
                    text,
                    confidence = 0.7,
                }
            )
        );
    }

    static string NormalizeCommand(string text)
    {
        text = text switch
        {
            "are tee oh" => "rto",
            "r t o" => "rto",
            "art o" => "rto",
            "artio" => "rto",
            "are tea oh" => "rto",
            "ta ra" => "tara",
            "t a r a" => "tara",
            "terra" => "tara",
            "config one plus eff" => "config one plus f",
            "con fig one plus eff" => "config one plus f",
            "config 1 plus f" => "config one plus f",
            "config two" => "config two",
            "config to" => "config two",
            _ => text,
        };

        var digits = TryParseDigitSequence(text);
        if (digits != null)
            return digits;

        return text;
    }

    static string? TryParseDigitSequence(string text)
    {
        var map = new Dictionary<string, char>
        {
            ["zero"] = '0',
            ["one"] = '1',
            ["two"] = '2',
            ["three"] = '3',
            ["four"] = '4',
            ["five"] = '5',
            ["six"] = '6',
            ["seven"] = '7',
            ["eight"] = '8',
            ["nine"] = '9',
            ["niner"] = '9',
        };

        var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return null;

        var result = new char[parts.Length];

        for (int i = 0; i < parts.Length; i++)
        {
            if (!map.TryGetValue(parts[i], out var digit))
                return null;

            result[i] = digit;
        }

        return new string(result);
    }

    static bool IsValidCommand(string text) => ValidCommands.Contains(text);

    static IEnumerable<string> GetDigitCommands(int maxDigits)
    {
        var digits = new[]
        {
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "niner",
        };

        var results = new List<string>();
        results.AddRange(digits);

        for (int length = 2; length <= maxDigits; length++)
            BuildDigitSequences(digits, length, new List<string>(), results);

        return results;
    }

    static void BuildDigitSequences(
        string[] digits,
        int remaining,
        List<string> current,
        List<string> output
    )
    {
        if (remaining == 0)
        {
            output.Add(string.Join(" ", current));
            return;
        }

        foreach (var d in digits)
        {
            current.Add(d);
            BuildDigitSequences(digits, remaining - 1, current, output);
            current.RemoveAt(current.Count - 1);
        }
    }

    static HashSet<string> GetValidCommands() =>
        new HashSet<string>
        {
            "lets prepare the aircraft",
            "lets prepare the flight",
            "lets set up the aircraft",
            "gear up",
            "gear down",
            "flaps zero",
            "flaps one",
            "flaps two",
            "flaps three",
            "flaps full",
            "landing lights on",
            "landing lights on please",
            "landing lights off",
            "landing lights off please",
            "strobe lights on",
            "strobe lights on please",
            "strobe lights off",
            "strobe lights off please",
            "taxi lights on",
            "taxi lights off",
            "flight director on",
            "flight director on please",
            "flight director off",
            "flight director off please",
            "bird on",
            "bird on please",
            "bird off",
            "bird off please",
            "turn off bird",
            "flight director off bird on",
            "flight director off bird on please",
            "auto pilot on",
            "auto pilot on please",
            "auto pilot one on",
            "autopilot on",
            "autopilot on please",
            "autopilot one on",
            "cancel checklist",
            "stop checklist",
            "abort checklist",
            "cockpit preparation checklist",
            "before start checklist",
            "before start procedure",
            "before start flow",
            "starting engine number one",
            "starting engine number two",
            "starting number one",
            "starting number two",
            "after start checklist",
            "clear left",
            "clear on the left",
            "left side clear",
            "clear left side",
            "taxi checklist",
            "removed",
            "line up checklist",
            "runway entry procedure",
            "clear to line up",
            "clear for takeoff",
            "before takeoff procedure",
            "takeoff",
            "approach checklist",
            "approach",
            "start approach checklist",
            "landing checklist",
            "parking checklist",
            "secure aircraft checklist",
            "ok to clean up",
            "clear to clean up",
            "lights please",
            "shutdown procedure",
            "shutdown",
            "flight controls check",
            "set",
            "on",
            "off",
            "armed",
            "check",
            "confirmed",
            "checked",
            "set and checked",
            "received",
            "config one plus f",
            "config one plus eff",
            "config 1 plus f",
            "con fig one plus eff",
            "config two",
            "config to",
            "config two",
            "advised",
            "signaled",
            "medium",
            "btv",
            "auto",
            "started",
            "running",
            "normal",
            "rto",
            "stop",
            "are tee oh",
            "r t o",
            "art o",
            "artio",
            "are tea oh",
            "tara",
            "ta ra",
            "t a r a",
            "terra",
            "zero",
            "up",
            "retracted",
            "down",
            "secured",
            "secure",
            "ta only",
            "chocks in place",
            "parking brake set",
            "wing anti ice on",
            "wing anti ice please",
            "wing anti ice off",
            "engine anti ice on",
            "engine anti ice please",
            "engine anti ice off",
            "starting one",
            "starting engine one",
            "starting engine number one",
            "starting two",
            "starting engine two",
            "starting engine number two",
        };
}
