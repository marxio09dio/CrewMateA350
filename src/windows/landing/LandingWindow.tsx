import { emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePerformanceStore } from "@/store/performanceStore"

export function LandingWindow() {
  const { landing, setLandingData } = usePerformanceStore()

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const parsedValue = name === "missedAltitude" ? Number(value) : value
    setLandingData({ [name]: value } as Partial<typeof landing>)
    const newLanding = { ...landing, [name]: parsedValue }
    emit("landing-updated", newLanding)
  }

  const handleClose = () => {
    getCurrentWindow().close()
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="flaps" className="text-sm text-slate-300">
              Flaps Setting
            </Label>
            <select
              id="flaps"
              name="flaps"
              value={landing.flaps}
              onChange={handleInputChange}
              className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="3">3</option>
              <option value="4">Full</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="missedAltitude" className="text-sm text-slate-300">
              Missed Approach (ft)
            </Label>
            <Input
              type="number"
              id="missedAltitude"
              name="missedAltitude"
              value={landing.missedAltitude}
              onChange={handleInputChange}
              className="h-9 bg-slate-900/50 border-slate-600 text-white text-sm font-mono focus-visible:ring-cyan-500"
              placeholder="4000"
            />
          </div>
        </div>
        <Button onClick={handleClose} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2">
          Close
        </Button>
      </div>
    </div>
  )
}
