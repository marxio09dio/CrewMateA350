import { emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePerformanceStore } from "@/store/performanceStore"

export function TakeoffWindow() {
  const { takeoff, setTakeoffData } = usePerformanceStore()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const parsedValue = name === "vr" ? Number(value) : value
    setTakeoffData({ [name]: parsedValue } as Partial<typeof takeoff>)
    const newTakeoff = { ...takeoff, [name]: parsedValue }
    emit("takeoff-updated", newTakeoff)
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="space-y-4">
        {/* V Speeds */}
        <div className="grid grid-cols-2 gap-3">
          {/* Vr */}
          <div className="space-y-1">
            <Label htmlFor="vr" className="text-sm text-slate-300">
              Vr (kts)
            </Label>
            <Input
              type="number"
              id="vr"
              name="vr"
              value={takeoff.vr}
              onChange={handleInputChange}
              className="h-9 bg-slate-900/50 border-slate-600 text-white text-sm font-mono focus-visible:ring-cyan-500"
              placeholder="150"
            />
          </div>

          {/* Packs */}
          <div className="space-y-1">
            <Label htmlFor="packs" className="text-sm text-slate-300">
              Packs
            </Label>
            <select
              id="packs"
              name="packs"
              value={takeoff.packs}
              onChange={handleInputChange}
              className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="on">ON</option>
              <option value="off">OFF</option>
              <option value="apu">APU TO PACK</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="antiIce" className="text-sm text-slate-300">
              Anti Ice
            </Label>

            <select
              id="antiIce"
              name="antiIce"
              value={takeoff.antiIce}
              onChange={handleInputChange}
              className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="off">OFF</option>
              <option value="oneng">ON (ENG)</option>
              <option value="onengwing">ON (ENG & WING)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Button onClick={handleClose} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2">
          Ok
        </Button>
      </div>
    </div>
  )
}
