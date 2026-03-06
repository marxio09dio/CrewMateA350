use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct AudioPlayer {
    _stream: Rc<OutputStream>,
    stream_handle: Arc<OutputStreamHandle>,
    is_playing: Arc<AtomicBool>,
}

unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

impl AudioPlayer {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let (stream, stream_handle) = OutputStream::try_default()?;
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
        device_name: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if self.is_playing.load(Ordering::SeqCst) {
            return Ok(());
        }

        let path_buf = path.as_ref().to_path_buf();
        let volume = volume.clamp(0.0, 10.0);
        let use_named_device = device_name
            .as_deref()
            .map(|n| !n.is_empty() && n != "default")
            .unwrap_or(false);

        self.is_playing.store(true, Ordering::SeqCst);

        if use_named_device {
            let name = device_name.unwrap();
            let playing_flag = self.is_playing.clone();
            std::thread::spawn(move || {
                if let Err(e) = play_on_named_device(&path_buf, &name, volume) {
                    log::error!("Failed to play audio on device '{}': {}", name, e);
                }
                playing_flag.store(false, Ordering::SeqCst);
            });
        } else {
            let sink = Sink::try_new(&self.stream_handle)?;
            let file = File::open(path_buf)?;
            let source = Decoder::new(BufReader::new(file))?;
            sink.append(source.amplify(volume));
            let playing_flag = self.is_playing.clone();
            std::thread::spawn(move || {
                sink.sleep_until_end();
                playing_flag.store(false, Ordering::SeqCst);
            });
        }

        Ok(())
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }
}

fn play_on_named_device(
    path: &PathBuf,
    name: &str,
    volume: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let found_device = host
        .output_devices()?
        .find(|d| d.name().unwrap_or_default() == name);

    let (stream, handle) = match found_device {
        Some(dev) => {
            OutputStream::try_from_device(&dev).or_else(|_| OutputStream::try_default())?
        }
        None => OutputStream::try_default()?,
    };

    let sink = Sink::try_new(&handle)?;
    let file = File::open(path)?;
    let source = Decoder::new(BufReader::new(file))?;
    sink.append(source.amplify(volume));
    let _stream = stream; // keep stream alive until playback ends
    sink.sleep_until_end();

    Ok(())
}
