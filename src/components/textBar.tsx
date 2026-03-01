import { useEffect, useState } from "react"

const CLEAR_DELAY_MS = 3000

interface TextBarProps {
  text: string | null
  isValidCommand: boolean
}

export function TextBar({ text, isValidCommand }: TextBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!text) {
      setVisible(false)
      return
    }

    setVisible(true)
    const timer = setTimeout(() => setVisible(false), CLEAR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <div className="mt-2 flex items-center gap-1.5 font-mono tracking-wide">
      <span className="text-cyan-400 text-xs">Voice:</span>
      {visible && text && (
        <span
          className={`text-sm font-medium transition-colors duration-200 ${
            isValidCommand ? "text-green-400" : "text-neutral-400"
          }`}
        >
          {text}
        </span>
      )}
    </div>
  )
}
