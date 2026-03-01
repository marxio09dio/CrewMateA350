import { listen } from "@tauri-apps/api/event"
import { useEffect, useRef, useState } from "react"

import { createVoiceCommands } from "@/voice/voiceCommands"

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

      setRecognizedText(spokenText)
      setIsValidCommand(!!matchedCommand)

      if (!matchedCommand) return

      try {
        await matchedCommand.action()
      } catch (error) {
        console.error(`Voice command error: ${String(error)}`)
      }
    })

    return () => {
      unlistenSpeech.then((f) => f())
    }
  }, [voiceEnabled])

  return { recognizedText, isValidCommand }
}
