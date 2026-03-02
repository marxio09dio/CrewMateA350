import * as updater from "@tauri-apps/plugin-updater"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export function UpdateChecker() {
  const [status, setStatus] = useState<string>("")
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<updater.Update | null>(null)

  const handleCheck = async () => {
    setChecking(true)
    setStatus("Checking for updates...")
    try {
      const res = await updater.check()
      if (!res) {
        setStatus("App is up to date")
        setUpdateInfo(null)
      } else {
        setStatus(`Update available: ${res.version}`)
        setUpdateInfo(res)
      }
    } catch (e) {
      console.error("Update check failed", e)
      setStatus("Failed to check for updates")
    }
    setChecking(false)
  }

  const handleInstall = async () => {
    setStatus("Installing update...")
    try {
      if (!updateInfo) return
      await updateInfo.downloadAndInstall((ev) => {
        if (ev.event === "Progress") {
          setStatus(`Downloading... ${ev.data.chunkLength} bytes`)
        } else if (ev.event === "Started") {
          setStatus("Download started")
        } else if (ev.event === "Finished") {
          setStatus("Download finished, installing...")
        }
      })
      setStatus("Installer launched")
    } catch (e) {
      console.error("Install failed", e)
      setStatus("Failed to install update")
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Check for updates"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
              className="h-7 px-2"
            >
              {checking ? "..." : "🔄"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Check for updates</TooltipContent>
        </Tooltip>

        {updateInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Install update" size="sm" onClick={handleInstall} className="h-7 px-2">
                ⬇️
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Install update</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>

      <span className="truncate max-w-[120px]">{status}</span>
    </div>
  )
}
