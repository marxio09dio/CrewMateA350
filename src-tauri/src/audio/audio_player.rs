use crate::audio::audio_devices;
use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// ── Silence trimming ──────────────────────────────────────────────────────────

struct DecodedSound {
    samples: Vec<i16>,
    channels: u16,
    sample_rate: u32,
}

fn trim_silence(samples: &[i16], threshold: i16, pad_samples: usize) -> Vec<i16> {
    let start = samples
        .iter()
        .position(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(0);
    let end = samples
        .iter()
        .rposition(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(samples.len().saturating_sub(1));
    let padded_start = start.saturating_sub(pad_samples);
    let padded_end = (end + pad_samples).min(samples.len().saturating_sub(1));
    samples[padded_start..=padded_end].to_vec()
}

fn load_and_trim<P: AsRef<Path>>(
    path: P,
) -> Result<DecodedSound, Box<dyn std::error::Error + Send + Sync>> {
    let file = File::open(path)?;
    let decoder = Decoder::new(BufReader::new(file))?;
    let channels = decoder.channels();
    let sample_rate = decoder.sample_rate();
    let raw: Vec<i16> = decoder.collect();
    let samples = trim_silence(&raw, 500, 200);
    Ok(DecodedSound {
        samples,
        channels,
        sample_rate,
    })
}

pub struct AudioPlayer {
    _stream: Rc<OutputStream>,
    pub stream_handle: Arc<OutputStreamHandle>,
    pub is_playing: Arc<AtomicBool>,
}

unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

impl AudioPlayer {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Self::with_device(None)
    }

    pub fn with_device(device: Option<String>) -> Result<Self, Box<dyn std::error::Error>> {
        // If no device specified or "default", use default
        let (stream, stream_handle) = match device.as_deref() {
            None | Some("default") => OutputStream::try_default()?,
            Some(idx) => {
                let devices = audio_devices::list_output_devices()?;
                let found = devices
                    .into_iter()
                    .find(|d| d.index == idx)
                    .ok_or_else(|| format!("Output device with index {} not found", idx))?;
                // Use rodio's try_from_device if available
                OutputStream::try_from_device(&found.device)?
            }
        };

        Ok(Self {
            _stream: Rc::new(stream),
            stream_handle: Arc::new(stream_handle),
            is_playing: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn play_from_path<P: AsRef<Path>>(
        &self,
        path: P,
        volume: f32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if self.is_playing.load(Ordering::SeqCst) {
            return Ok(());
        }

        let sink = Sink::try_new(&self.stream_handle)?;
        let file = File::open(path)?;
        let source = Decoder::new(BufReader::new(file))?;

        let volume = volume.clamp(0.0, 10.0);
        let source = source.amplify(volume);

        self.is_playing.store(true, Ordering::SeqCst);
        sink.append(source);

        let playing_flag = self.is_playing.clone();
        std::thread::spawn(move || {
            sink.sleep_until_end();
            playing_flag.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }
}

/// Decode, silence-trim, and play `paths` back-to-back as a single gapless sequence.
/// Blocks until the last sample finishes. Intended to be called from `spawn_blocking`.
pub fn play_sequence_trimmed(
    stream_handle: &OutputStreamHandle,
    is_playing: &Arc<AtomicBool>,
    paths: Vec<std::path::PathBuf>,
    volume: f32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if paths.is_empty() || is_playing.load(Ordering::SeqCst) {
        return Ok(());
    }

    let volume = volume.clamp(0.0, 10.0);
    let mut cache: HashMap<String, DecodedSound> = HashMap::new();
    for path in &paths {
        let key = path.to_string_lossy().to_string();
        if let std::collections::hash_map::Entry::Vacant(e) = cache.entry(key) {
            e.insert(load_and_trim(path)?);
        }
    }

    let sink = Sink::try_new(stream_handle)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
    for path in &paths {
        let key = path.to_string_lossy().to_string();
        if let Some(s) = cache.get(&key) {
            sink.append(
                SamplesBuffer::new(s.channels, s.sample_rate, s.samples.clone()).amplify(volume),
            );
        }
    }

    is_playing.store(true, Ordering::SeqCst);
    sink.sleep_until_end();
    is_playing.store(false, Ordering::SeqCst);
    Ok(())
}
