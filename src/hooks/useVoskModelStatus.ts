import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useCallback, useEffect, useState } from "react"

type UseVoskModelStatusOptions = {
  setVoiceEnabled: (enabled: boolean) => void
}

export function useVoskModelStatus({ setVoiceEnabled }: UseVoskModelStatusOptions) {
  const [voskModelAvailable, setVoskModelAvailable] = useState<boolean | null>(null)
  const [voskModelSelected, setVoskModelSelected] = useState<boolean | null>(null)

  const checkModelStatus = useCallback(async () => {
    try {
      const hasModel = await invoke<boolean>("check_vosk_model_status")
      const selectedModel = await invoke<string | null>("get_selected_vosk_model")
      console.log("[VOSK] Model check result:", hasModel, "Selected:", selectedModel)
      setVoskModelAvailable(hasModel)
      setVoskModelSelected(!!selectedModel)
    } catch (error) {
      console.error("[VOSK] Failed to check model status:", error)
      setVoskModelAvailable(false)
      setVoskModelSelected(false)
    }
  }, [])

  useEffect(() => {
    setVoiceEnabled(false)

    const timeoutId = window.setTimeout(() => {
      void checkModelStatus()
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [checkModelStatus, setVoiceEnabled])

  useEffect(() => {
    const listeners = [
      {
        eventName: "vosk-model-download-complete",
        logMessage: "[VOSK] Model download complete, re-checking status..."
      },
      {
        eventName: "vosk-model-selected",
        logMessage: "[VOSK] Model selected, re-checking status..."
      },
      {
        eventName: "vosk-model-deleted",
        logMessage: "[VOSK] Model deleted, re-checking status..."
      },
      {
        eventName: "vosk-all-models-deleted",
        logMessage: "[VOSK] All models deleted, re-checking status..."
      }
    ] as const

    const unlistenPromises = listeners.map(({ eventName, logMessage }) =>
      listen(eventName, async () => {
        console.log(logMessage)
        if (eventName === "vosk-all-models-deleted") {
          setVoiceEnabled(false)
        }
        await checkModelStatus()
      })
    )

    return () => {
      unlistenPromises.forEach((unlisten) => {
        unlisten.then((fn) => fn())
      })
    }
  }, [checkModelStatus, setVoiceEnabled])

  return {
    voskModelAvailable,
    voskModelSelected,
    checkModelStatus
  }
}
