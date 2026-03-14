import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { FolderOpen, Volume2, ClipboardList } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { VoiceModelSettings } from "@/components/VoiceModelSettings"
import { useChecklistStore } from "@/store/checklistStore"
import { useVoiceStore } from "@/store/voiceStore"

export function SettingsWindow() {
  const [availableSoundPacks, setAvailableSoundPacks] = useState<string[]>([])

  const { soundPack, setSoundPack } = useVoiceStore()
  const { holdOnIncorrect, setHoldOnIncorrect } = useChecklistStore()

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

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  const handleClose = () => {
    getCurrentWindow().close()
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-1">
          <Volume2 className="h-3 w-3 text-cyan-400 shrink-0" />
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Audio</span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <Label className="text-sm text-slate-300">Copilot</Label>

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

        <div className="flex items-center gap-2 pt-1">
          <ClipboardList className="h-3 w-3 text-cyan-400 shrink-0" />
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Checklist</span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <Label htmlFor="holdOnIncorrect" className="text-sm text-slate-300 cursor-pointer">
            Hold checklist on incorrect item
          </Label>
          <Checkbox
            id="holdOnIncorrect"
            checked={holdOnIncorrect}
            onCheckedChange={(checked) => setHoldOnIncorrect(checked === true)}
          />
        </div>

        <Button
          onClick={() => invoke("open_app_data_folder")}
          className="w-full bg-slate-800 border border-slate-500 text-white hover:bg-slate-700 font-semibold py-2"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Open App Data Folder
        </Button>

        <Button onClick={handleClose} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2">
          Close
        </Button>
      </div>
    </div>
  )
}
