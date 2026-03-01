import { invoke } from "@tauri-apps/api/core"
import { PlaneTakeoff, PlaneLanding, PinIcon, PinOff, Mic, MicOff, SettingsIcon, Clock } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useFlowStore } from "@/store/flowStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { openLandingWindow, openSettingsWindow, openTakeoffWindow } from "@/windows/windowsHandler"

type IconToolbarProps = {
  voiceEnabled: boolean
  onToggleVoice: () => void
  voiceDisabled: boolean
}

export function IconToolbar({ voiceEnabled, onToggleVoice, voiceDisabled }: IconToolbarProps) {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)

  const timerRunning = usePreflightTimerStore((s) => s.isRunning)
  const remainingSeconds = usePreflightTimerStore((s) => s.remainingSeconds)
  const startTimer = usePreflightTimerStore((s) => s.start)
  const skipMinute = usePreflightTimerStore((s) => s.skipMinute)

  const flowRunning = useFlowStore((s) => s.executionState === "running")

  const minutes = Math.floor(remainingSeconds / 60)
  const timeDisplay = `${String(minutes).padStart(2, "0")}`

  const handleToggleAlwaysOnTop = async () => {
    const newValue = !alwaysOnTop
    try {
      await invoke("set_always_on_top", { alwaysOnTop: newValue })
      setAlwaysOnTop(newValue)
    } catch (error) {
      console.error("Failed to set always on top:", error)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleVoice}
              disabled={voiceDisabled}
              className={`
                w-9 h-9 p-0 bg-transparent border border-slate-700/50
                hover:bg-cyan-400/10
                ${voiceEnabled ? "border-red-400 hover:border-red-400" : ""}
              `}
            >
              {voiceEnabled ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-cyan-300" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{voiceEnabled ? "Stop Listening" : "Start Listening"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleToggleAlwaysOnTop}
              className={`
                w-9 h-9 p-0 bg-transparent border border-slate-700/50
                hover:bg-amber-400/10
                transition
                ${alwaysOnTop ? "border-amber-400" : ""}
              `}
            >
              {alwaysOnTop ? (
                <PinOff className="w-5 h-5 text-amber-400" />
              ) : (
                <PinIcon className="w-5 h-5 text-amber-300" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{alwaysOnTop ? "Unpin App" : "Pin App"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={timerRunning ? skipMinute : startTimer}
              disabled={flowRunning}
              className={`
    h-9 p-0 bg-transparent border border-slate-700/50
    transition
    ${timerRunning ? "border-blue-600 hover:bg-blue-600/10 px-2 gap-1.5" : "w-9 hover:bg-blue-400/10"}
  `}
            >
              <Clock className={`w-5 h-5 ${timerRunning ? "text-blue-600" : "text-blue-400"}`} />
              {timerRunning && <span className="text-xs font-mono text-blue-300">{timeDisplay}m</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{timerRunning ? "Skip 1 min" : "Start preflight countdown"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={openTakeoffWindow}
              className="
                w-9 h-9 p-0 bg-transparent border border-slate-700/50
                hover:bg-emerald-400/10
                transition
              "
            >
              <PlaneTakeoff className="w-5 h-5 text-emerald-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Takeoff Performance</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={openLandingWindow}
              className="
                w-9 h-9 p-0 bg-transparent border border-slate-700/50
                hover:bg-violet-400/10
                transition
              "
            >
              <PlaneLanding className="w-5 h-5 text-violet-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Landing Performance</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={openSettingsWindow}
              className="
                w-9 h-9 p-0 bg-transparent border border-slate-700/50
                hover:bg-slate-400/10
                transition
              "
            >
              <SettingsIcon className="w-5 h-5 text-slate-300" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
