import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { ask } from "@tauri-apps/plugin-dialog"
import { useEffect } from "react"

export function useCloseConfirm() {
  useEffect(() => {
    const unlisten = listen("close-requested", async () => {
      const shouldClose = await ask("Are you sure you want to exit SimBookLog?", {
        title: "Confirm Exit",
        kind: "warning"
      })

      if (shouldClose) {
        await invoke("close_app")
      }
    })

    return () => {
      unlisten.then((f) => f())
    }
  }, [])
}
