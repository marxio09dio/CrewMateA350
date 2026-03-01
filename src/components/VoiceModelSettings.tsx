import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { Download, Trash2, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

interface VoskModelInfo {
  id: string
  name: string
  description: string
  size_mb: number
  url: string
  filename: string
  is_downloaded: boolean
  is_downloading: boolean
  partial_size: number
  languages: string[]
}

interface DownloadProgress {
  model_id: string
  downloaded: number
  total: number
  percentage: number
}

export function VoiceModelSettings() {
  const [models, setModels] = useState<VoskModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map())

  const loadModels = async () => {
    setLoading(true)
    try {
      const [availableModels, selected] = await Promise.all([
        invoke<VoskModelInfo[]>("get_vosk_models"),
        invoke<string | null>("get_selected_vosk_model")
      ])
      setModels(availableModels)
      setSelectedModel(selected || "")
    } catch (error) {
      console.error("Failed to load models:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()

    // Listen for download progress
    const unlisten = listen<DownloadProgress>("vosk-model-download-progress", (event) => {
      setDownloadProgress((prev) => {
        const newMap = new Map(prev)
        newMap.set(event.payload.model_id, event.payload)
        return newMap
      })
    })

    // Listen for download complete
    const unlistenComplete = listen<string>("vosk-model-download-complete", () => {
      loadModels()
      setDownloadProgress(new Map())
    })

    return () => {
      unlisten.then((fn) => fn())
      unlistenComplete.then((fn) => fn())
    }
  }, [])

  const handleDownload = async (modelId: string) => {
    try {
      // Update local state immediately
      setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, is_downloading: true } : m)))

      await invoke("download_vosk_model", { modelId })
    } catch (error) {
      console.error("Failed to download model:", error)
      // Revert state on error
      loadModels()
    }
  }

  const handleDelete = async (modelId: string) => {
    if (!confirm("Are you sure you want to delete this model?")) {
      return
    }

    try {
      await invoke("delete_vosk_model", { modelId })
      // If we deleted the selected model, clear the selection
      if (selectedModel === modelId) {
        setSelectedModel("")
      }
      await loadModels()
    } catch (error) {
      console.error("Failed to delete model:", error)
    }
  }

  const handleSelectModel = async (modelId: string) => {
    try {
      await invoke("set_selected_vosk_model", { modelId })
      setSelectedModel(modelId)
    } catch (error) {
      console.error("Failed to select model:", error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading models...</span>
        </div>
      </div>
    )
  }

  const downloadedModels = models.filter((m) => m.is_downloaded)
  const notDownloadedModels = models.filter((m) => !m.is_downloaded)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[120px_1fr] items-center gap-3">
        <Label className="text-sm text-slate-300">Voice Model</Label>
        <select
          value={selectedModel}
          onChange={(e) => handleSelectModel(e.target.value)}
          disabled={downloadedModels.length === 0}
          className="w-full h-9 bg-slate-900/50 border border-slate-600 text-white text-sm rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloadedModels.length === 0 ? (
            <option value="">No models installed</option>
          ) : (
            <>
              <option value="">Select a model</option>
              {downloadedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.size_mb} MB)
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {notDownloadedModels.length > 0 && (
        <div className="grid grid-cols-[120px_1fr] items-start gap-3">
          <Label className="text-sm text-slate-300 pt-1">Download</Label>
          <div className="space-y-2">
            {notDownloadedModels.map((model) => {
              const progress = downloadProgress.get(model.id)
              const isDownloading = model.is_downloading || !!progress

              return (
                <div key={model.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-white">{model.name}</div>
                      <div className="text-xs text-slate-400">
                        {model.size_mb} MB • {model.languages.join(", ")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(model.id)}
                      disabled={isDownloading}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Downloading
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                  {progress && (
                    <div className="space-y-1">
                      <Progress value={progress.percentage} className="h-1" />
                      <p className="text-xs text-slate-400 text-right">
                        {(progress.downloaded / 1024 / 1024).toFixed(1)} / {(progress.total / 1024 / 1024).toFixed(1)}{" "}
                        MB ({progress.percentage.toFixed(0)}%)
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {downloadedModels.length > 0 && (
        <div className="grid grid-cols-[120px_1fr] items-start gap-3">
          <Label className="text-sm text-slate-300 pt-1">Manage</Label>
          <div className="space-y-1">
            {downloadedModels.map((model) => (
              <div key={model.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{model.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(model.id)}
                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
