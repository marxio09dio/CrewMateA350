import { listen } from "@tauri-apps/api/event"
import { useEffect, useRef, useState } from "react"

import { playSound } from "@/services/playSounds"
import { useChecklistStore } from "@/store/checklistStore"
import { createVoiceCommands, numericPrefixCommands } from "@/voice/voiceCommands"

type SpeechRecognizedPayload = {
  type?: string
  text?: string
  confidence?: number
}

type UseSpeechCommandsOptions = {
  voiceEnabled: boolean
}

export function useSpeechCommands({ voiceEnabled }: UseSpeechCommandsOptions) {
  const [recognizedText, setRecognizedText] = useState<string | null>(null)
  const [isValidCommand, setIsValidCommand] = useState(false)
  const commandsRef = useRef(createVoiceCommands())

  useEffect(() => {
    const commands = commandsRef.current

    const unlistenSpeech = listen<SpeechRecognizedPayload>("speech_recognized", async (event) => {
      if (!voiceEnabled) return

      const spokenText = event.payload?.text?.trim().toLowerCase()
      if (!spokenText) return

      const matchedCommand = commands.find((command) =>
        command.phrases.some((phrase) => {
          const normalizedPhrase = phrase.toLowerCase()
          return command.exactMatch ? spokenText === normalizedPhrase : spokenText.includes(normalizedPhrase)
        })
      )

      // While a checklist challenge/response loop is active, the checklist
      // runner handles speech directly — suppress regular command processing
      // unless a command explicitly opts-in to run during checklist execution.
      if (useChecklistStore.getState().executionState === "running" && !matchedCommand?.allowDuringChecklist) return

      setRecognizedText(spokenText)
      setIsValidCommand(!!matchedCommand)

      if (matchedCommand) {
        try {
          await matchedCommand.action()
        } catch (error) {
          console.error(`Voice command error: ${String(error)}`)
        }
        return
      }

      // Numeric prefix commands: sidecar emits e.g. "set heading 238"
      for (const [prefix, handler] of Object.entries(numericPrefixCommands)) {
        if (spokenText.startsWith(prefix)) {
          const value = parseInt(spokenText.slice(prefix.length), 10)
          if (!isNaN(value)) {
            setIsValidCommand(true)
            try {
              await handler(value)
            } catch (error) {
              console.error(`Numeric command error: ${String(error)}`)
            }
          }
          return
        }
      }

      // Airbus FMA callout (e.g. "man toga srs runway", "loc blue gs blue", "nav").
      const FMA_PREFIXES = [
        "man ",
        "thr ",
        "thrust ",
        "alpha ",
        "toga ",
        "speed",
        "mach",
        "srs",
        "clb",
        "climb",
        "op clb",
        "exp clb",
        "alt",
        "altitude",
        "des",
        "descent",
        "op des",
        "exp des",
        "vs",
        "fpa",
        "gs",
        "glide ",
        "flare",
        "rollout",
        "land",
        "nav",
        "hdg",
        "trk",
        "loc",
        "localiser",
        "ga trk",
        "runway",
        "autothrust"
      ]
      if (FMA_PREFIXES.some((p) => spokenText.startsWith(p))) {
        setIsValidCommand(true)
        await playSound("check.ogg")
        return
      }
    })

    return () => {
      unlistenSpeech.then((f) => f())
    }
  }, [voiceEnabled])

  return { recognizedText, isValidCommand }
}
