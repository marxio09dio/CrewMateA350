import { ChecklistPanel } from "@/components/ChecklistPanel"
import { FlowPanel } from "@/components/FlowPanel"
import { Footer } from "@/components/Footer"
import { IconToolbar } from "@/components/IconToolbar"
import { NoVoiceModel } from "@/components/noVoiceModel"
import { TextBar } from "@/components/textBar"
import { useAutoFlows } from "@/hooks/useAutoFlows"
import { useCallouts } from "@/hooks/useCallouts"
import { useCloseConfirm } from "@/hooks/useCloseConfirm"
import { usePreflightTimer } from "@/hooks/usePreflightTimer"
import { useSimConnection } from "@/hooks/useSimConnection"
import { useSpeechCommands } from "@/hooks/useSpeechCommands"
import { useVoskModelStatus } from "@/hooks/useVoskModelStatus"
import { usePerformanceStore } from "@/store/performanceStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import { useVoiceStore } from "@/store/voiceStore"

import "./App.css"
import { usePreflightTimerStore } from "./store/preflightTimerStore"

function App() {
  useSimConnection()

  const status = useTelemetryStore((state) => state.status)
  const connected = status === "connected"

  const voiceEnabled = useVoiceStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useVoiceStore((state) => state.setVoiceEnabled)
  const takeoffVr = usePerformanceStore((state) => state.takeoff.vr)
  const { voskModelAvailable, voskModelSelected } = useVoskModelStatus({ setVoiceEnabled })

  useCallouts(takeoffVr)
  useAutoFlows()
  usePreflightTimer()
  const { recognizedText, isValidCommand } = useSpeechCommands({ voiceEnabled })
  useCloseConfirm()

  const currentEvent = usePreflightTimerStore((s) => s.currentEvent)

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 bg-black text-white p-2">
        <div className="max-w-6xl mx-auto">
          {!connected ? (
            <div className="flex flex-col items-center justify-center mb-6 py-5">
              <div className="relative flex items-center justify-center mb-4">
                <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-cyan-200 text-sm opacity-80">Waiting for simulator to start...</p>
              <span className="text-xs text-cyan-400/70 mt-3 animate-pulse">Auto-reconnecting</span>
            </div>
          ) : (
            <>
              <IconToolbar
                voiceEnabled={voiceEnabled}
                onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
                voiceDisabled={!voskModelAvailable || !voskModelSelected}
              />

              {voskModelAvailable === false || voskModelSelected === false ? (
                <NoVoiceModel voskModelAvailable={voskModelAvailable ?? false} />
              ) : (
                <>
                  <TextBar text={recognizedText} isValidCommand={isValidCommand} />
                  {currentEvent && (
                    <span className="text-xs text-cyan-300/80 font-mono animate-pulse truncate max-w-[140px]">
                      {currentEvent}
                    </span>
                  )}

                  <FlowPanel />
                  <ChecklistPanel />
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default App
