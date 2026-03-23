interface SpeechEngineErrorProps {
  message: string
}

export function SpeechEngineError({ message }: SpeechEngineErrorProps) {
  const isNoMic = message.toLowerCase().includes("no default audio input")

  return (
    <div className="mb-3 rounded-md border border-amber-500/60 bg-amber-950/50 px-4 py-3 text-sm">
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-amber-400">Voice recognition unavailable</p>
        {isNoMic ? (
          <p className="mt-1 text-amber-200/80">
            No default microphone was found. Connect a microphone and set it as the default input in{" "}
            <strong>Windows Settings → System → Sound → Input</strong>, then restart the app.
          </p>
        ) : (
          <p className="mt-1 text-amber-200/80">{message}</p>
        )}
      </div>
    </div>
  )
}
