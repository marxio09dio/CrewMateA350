import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect } from "react"

import { ChecklistPanel } from "@/components/ChecklistPanel"
import { ConnectionError } from "@/components/connectionError"
import { FlowPanel } from "@/components/FlowPanel"
import { Footer } from "@/components/Footer"
import { IconToolbar } from "@/components/IconToolbar"
import { TextBar } from "@/components/textBar"
import { useAutoFlows } from "@/hooks/useAutoFlows"
import { useBaroSync } from "@/hooks/useBaroSync"
import { useCallouts } from "@/hooks/useCallouts"
import { useCloseConfirm } from "@/hooks/useCloseConfirm"
import { usePreflightTimer } from "@/hooks/usePreflightTimer"
import { useSimConnection } from "@/hooks/useSimConnection"
import { useSpeechCommands } from "@/hooks/useSpeechCommands"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import "./App.css"

function App() {
  useSimConnection()
  useBaroSync()

  const status = useTelemetryStore((state) => state.status)
  const connected = status === "connected"

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled)
  const takeoffVr = usePerformanceStore((state) => state.takeoff.vr)

  useCallouts(takeoffVr)
  useAutoFlows()
  usePreflightTimer()
  const { recognizedText, isValidCommand, isUnrecognized, speechKey } = useSpeechCommands({ voiceEnabled })
  useCloseConfirm()

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  const currentEvent = usePreflightTimerStore((s) => s.currentEvent)

  return (
    <div className="flex  bg-black flex-col min-h-screen">
      <main className="flex-1 text-white p-2">
        <div className="max-w-6xl mx-auto">
          {!connected ? (
            <ConnectionError />
          ) : (
            <>
              <IconToolbar
                voiceEnabled={voiceEnabled}
                onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
                voiceDisabled={false}
              />
              <TextBar
                text={recognizedText}
                isValidCommand={isValidCommand}
                isUnrecognized={isUnrecognized}
                speechKey={speechKey}
              />
              {currentEvent && (
                <span className="text-xs text-cyan-300/80 font-mono animate-pulse truncate max-w-[140px]">
                  {currentEvent}
                </span>
              )}
              <FlowPanel />
              <ChecklistPanel />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default App
