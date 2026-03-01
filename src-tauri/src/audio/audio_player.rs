use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
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
