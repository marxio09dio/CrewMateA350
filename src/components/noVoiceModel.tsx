import { MicOff } from "lucide-react"

type NoVoiceModelProps = {
  voskModelAvailable: boolean
}

export function NoVoiceModel({ voskModelAvailable }: NoVoiceModelProps) {
  return (
    <div className="mt-3 p-3 bg-amber-950/30 border border-amber-700/50 rounded-md">
      <div className="flex items-start gap-2">
        <MicOff className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-amber-300/80">
            {voskModelAvailable === false
              ? "Download a voice model to enable voice commands."
              : "Select a voice model in Settings to enable voice commands."}
          </p>
        </div>
      </div>
    </div>
  )
}
