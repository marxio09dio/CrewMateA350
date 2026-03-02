import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { VoiceModelSettings } from "@/components/VoiceModelSettings"
import { useVoiceStore } from "@/store/voiceStore"

export function SettingsWindow() {
  const [availableSoundPacks, setAvailableSoundPacks] = useState<string[]>([])
  const [isCapturingKey, setIsCapturingKey] = useState(false)

  const { soundPack, setPttShortcut, setSoundPack } = useVoiceStore()

  useEffect(() => {
    const fetchSoundPacks = async () => {
      try {
        const packs = await invoke<string[]>("get_sound_packs")

        if (!packs || packs.length === 0) {
          setAvailableSoundPacks([])
          return
        }

        setAvailableSoundPacks(packs)

        if (!packs.includes(soundPack)) {
          setSoundPack(packs[0])
        }
      } catch (error) {
        console.error("Failed to fetch sound packs:", error)
        setAvailableSoundPacks([])
      }
    }

    fetchSoundPacks()
  }, [])

  const handleClose = () => {
    getCurrentWindow().close()
  }

  const [capturedKeys, setCapturedKeys] = useState<string[]>([])

  useEffect(() => {
    if (!isCapturingKey) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === "Escape") {
        setCapturedKeys([])
        setIsCapturingKey(false)
        return
      }

      const keys: string[] = []

      if (e.ctrlKey || e.metaKey) keys.push("CmdOrCtrl")
      if (e.altKey) keys.push("Alt")
      if (e.shiftKey) keys.push("Shift")

      if (!["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
        let mainKey = e.key

        if (e.key === " ") mainKey = "Space"
        else if (e.key.startsWith("Arrow")) mainKey = e.key.replace("Arrow", "")
        else if (e.key.length === 1) mainKey = e.key.toUpperCase()

        keys.push(mainKey)
      }

      if (keys.length > 0) {
        setCapturedKeys(keys)
      }
    }

    const handleKeyUp = () => {
      if (capturedKeys.length > 0) {
        setPttShortcut(capturedKeys.join("+"))
        setCapturedKeys([])
        setIsCapturingKey(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("keyup", handleKeyUp, true)

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      window.removeEventListener("keyup", handleKeyUp, true)
    }
  }, [isCapturingKey, capturedKeys, setPttShortcut])

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="space-y-4">
        {/* Voice Commands Section */}
        <div className="space-y-4">
          {/* Voice Mode Selection */}
          {/* <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label className="text-slate-300">Mic Mode</Label>

            <select
              id="micMode"
              name="micMode"
              disabled={voiceEnabled}
              value={voiceMode}
              onChange={(e) => setVoiceMode(e.target.value as "continuous" | "ptt")}
              className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="continuous">Open Mic</option>
              <option value="ptt">Push-to-Talk</option>
            </select>
          </div> */}

          {/* PTT Shortcut Display/Edit */}
          {/* <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <Label className="text-slate-300">PTT Shortcut</Label>

            <div className="flex items-center gap-2">
              <Button
                disabled={voiceMode !== "ptt"}
                onClick={() => {
                  setCapturedKeys([])
                  setIsCapturingKey(true)
                }}
                className={`
                  flex-1 px-3 py-2 rounded-md font-mono text-sm
                  transition border
                  ${
                    isCapturingKey
                      ? "bg-cyan-700/20 border-cyan-400 text-cyan-300 animate-pulse"
                      : "bg-slate-900/50 border-slate-600 text-cyan-400 hover:bg-slate-700"
                  }
                `}
              >
                {isCapturingKey
                  ? capturedKeys.length > 0
                    ? capturedKeys.join(" + ").replace("CmdOrCtrl", "Ctrl")
                    : "Press shortcut (ESC)"
                  : pttShortcut.replace("CmdOrCtrl", "Ctrl")}
              </Button>
            </div>
          </div> */}
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Sound Pack</Label>

          <select
            id="soundPack"
            name="soundPack"
            value={soundPack}
            onChange={(e) => setSoundPack(e.target.value)}
            className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {availableSoundPacks.map((pack) => (
              <option key={pack} value={pack}>
                {pack}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Sound Volume</Label>
          <div className="flex items-center gap-3">
            <Slider
              className="flex-1"
              value={[useVoiceStore.getState().soundVolume]}
              onValueChange={(value) => useVoiceStore.getState().setSoundVolume(value[0])}
              min={0}
              max={200}
              step={1}
            />
            <span className="w-12 text-right text-xs text-cyan-400 font-mono">
              {useVoiceStore.getState().soundVolume}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Mic Gain</Label>
          <div className="flex items-center gap-3">
            <Slider
              className="flex-1"
              value={[useVoiceStore.getState().micGain]}
              onValueChange={(value) => useVoiceStore.getState().setMicGain(value[0])}
              min={50}
              max={400}
              step={10}
            />
            <span className="w-12 text-right text-xs text-cyan-400 font-mono">{useVoiceStore.getState().micGain}%</span>
          </div>
        </div>

        <VoiceModelSettings />

        <Button onClick={handleClose} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2">
          Close
        </Button>
      </div>
    </div>
  )
}
