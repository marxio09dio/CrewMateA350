import type { VoiceHintPhase } from "@/services/voiceHintResolver"

type VoiceGuideProps = {
  phase: VoiceHintPhase | null
}

export function VoiceGuide({ phase }: VoiceGuideProps) {
  const phrases = phase?.phrases ?? []

  if (!phase || phrases.length === 0) return null

  return (
    <div className="mt-2 text-xs">
      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 text-amber-400/90`}>You can say</div>
      <div className="flex flex-wrap gap-1">
        {phrases.map((p) => (
          <span
            key={p}
            className={`rounded px-1.5 py-px font-mono text-[10px] border border-slate-600/60 bg-slate-800/50 text-slate-300`}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  )
}
