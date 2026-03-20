using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace SpeechTrainer
{
    internal sealed class MainForm : Form
    {
        private const int BatchSize = 20;

        private static readonly Guid SpInprocRecognizerClsid = new Guid(
            "41B89B6B-9399-11D2-9623-00C04F8EE628"
        );

        private Button _btnStart;
        private Label _lblStatus;
        private ProgressBar _progress;

        private string[] _phrases = Array.Empty<string>();
        private dynamic _recognizers;
        private int _recognizerIndex;

        public MainForm()
        {
            BuildUi();
            Load += OnLoad;
        }

        // ── UI ────────────────────────────────────────────────────────────────────

        private void BuildUi()
        {
            Text = "CrewMate A350 — Speech Training";
            ClientSize = new Size(420, 130);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;

            _lblStatus = new Label
            {
                Text = "Initialising…",
                AutoSize = false,
                Size = new Size(396, 40),
                Location = new Point(12, 12),
                TextAlign = ContentAlignment.MiddleLeft,
            };

            _progress = new ProgressBar
            {
                Location = new Point(12, 58),
                Size = new Size(396, 20),
                Minimum = 0,
            };

            _btnStart = new Button
            {
                Text = "Start Training",
                Location = new Point(148, 88),
                Size = new Size(124, 30),
                Enabled = false,
            };
            _btnStart.Click += OnStartClick;

            Controls.AddRange(new Control[] { _lblStatus, _progress, _btnStart });
        }

        // ── Initialisation ────────────────────────────────────────────────────────

        private void OnLoad(object sender, EventArgs e)
        {
            // SAPI DisplayUI("UserTraining") hard-requires Windows Display Language = en-US.
            var culture = CultureInfo.CurrentUICulture;
            if (!culture.Name.Equals("en-US", StringComparison.OrdinalIgnoreCase))
            {
                MessageBox.Show(
                    "Your Windows Display Language is '"
                        + culture.DisplayName
                        + "'.\n\n"
                        + "SAPI voice training requires English (United States) as the Windows Display Language.\n\n"
                        + "Go to Settings → Time & Language → Language & Region, set English (United States) as "
                        + "the display language, sign out and back in, then run this tool again.",
                    Text,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                _lblStatus.Text = "Unsupported display language: " + culture.DisplayName;
                return;
            }

            var phrasePath = Path.Combine(
                Path.GetDirectoryName(System.Reflection.Assembly.GetEntryAssembly().Location),
                "training_phrases.txt"
            );

            if (!File.Exists(phrasePath))
            {
                _lblStatus.Text = "training_phrases.txt not found next to exe.";
                return;
            }

            _phrases = File.ReadAllLines(phrasePath)
                .Select((l) => l.Trim())
                .Where((l) => l.Length > 0 && !l.StartsWith("#"))
                .ToArray();

            var engine = CreateEngine();
            if (engine == null)
            {
                _lblStatus.Text =
                    "Could not create SAPI recognizer. Is Speech Recognition installed?";
                return;
            }

            _recognizers = engine.GetRecognizers();
            _recognizerIndex = FindSr8Index();

            var name = (string)_recognizers.Item(_recognizerIndex).GetDescription();
            _lblStatus.Text =
                "Recognizer: "
                + name
                + "\r\n"
                + _phrases.Length
                + " phrases · "
                + Batches()
                + " session(s) of "
                + BatchSize;
            _progress.Maximum = _phrases.Length;
            _btnStart.Enabled = true;
        }

        // ── Training ──────────────────────────────────────────────────────────────

        private void OnStartClick(object sender, EventArgs e)
        {
            _btnStart.Enabled = false;
            const string title = "CrewMate A350 — Voice Training";

            try
            {
                for (var batch = 0; batch < Batches(); batch++)
                {
                    var slice = _phrases.Skip(batch * BatchSize).Take(BatchSize).ToArray();
                    object data = ToMultiString(slice);

                    var engine = CreateEngine();
                    engine.Recognizer = _recognizers.Item(_recognizerIndex);
                    engine.DisplayUI(Handle.ToInt32(), title, "UserTraining", ref data);

                    var done = Math.Min((batch + 1) * BatchSize, _phrases.Length);
                    _progress.Value = done;

                    var remaining = _phrases.Length - done;
                    if (remaining > 0)
                    {
                        var cont = MessageBox.Show(
                            remaining + " phrase(s) remaining. Continue?",
                            title,
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (cont == DialogResult.No)
                            break;
                    }
                    else
                    {
                        MessageBox.Show(
                            "Training complete! SAPI now knows your voice for all CrewMate commands.",
                            title,
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Training error: " + ex.Message,
                    title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                _btnStart.Enabled = true;
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private int Batches() => (int)Math.Ceiling(_phrases.Length / (double)BatchSize);

        private int FindSr8Index()
        {
            var count = (int)_recognizers.Count;
            for (var i = 0; i < count; i++)
            {
                var desc = (string)_recognizers.Item(i).GetDescription();
                if (
                    desc.IndexOf("8.0", StringComparison.OrdinalIgnoreCase) >= 0
                    && desc.IndexOf("English", StringComparison.OrdinalIgnoreCase) >= 0
                )
                    return i;
            }
            return 0;
        }

        private static dynamic CreateEngine()
        {
            try
            {
                return Activator.CreateInstance(
                    System.Runtime.InteropServices.Marshal.GetTypeFromCLSID(SpInprocRecognizerClsid)
                );
            }
            catch
            {
                return null;
            }
        }

        private static string ToMultiString(IEnumerable<string> phrases)
        {
            var sb = new StringBuilder();
            foreach (var p in phrases)
            {
                sb.Append(p);
                sb.Append('\0');
            }
            return sb.ToString();
        }
    }
}
