import { mobiflightSet } from "@/API/mobiflightApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

type A350Variant = "A350-900" | "A350-1000"

const flapSpeedLimits: Record<A350Variant, Record<number, number>> = {
  "A350-900": {
    1: 255,
    2: 212,
    3: 195,
    4: 186
  },
  "A350-1000": {
    1: 260,
    2: 219,
    3: 206,
    4: 192
  }
}

const keyEventMap: Record<number, string> = {
  0: "FLAPS_UP",
  1: "FLAPS_1",
  2: "FLAPS_2",
  3: "FLAPS_3",
  4: "FLAPS_DOWN"
}

const soundMap: Record<number, string> = {
  0: "flaps_0.ogg",
  1: "flaps_1.ogg",
  2: "flaps_2.ogg",
  3: "flaps_3.ogg",
  4: "flaps_full.ogg"
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getA350Variant(title?: string): A350Variant | null {
  if (!title) return null

  const normalized = title.toUpperCase()

  const is1000 = /A\s*350[\s-]*1000\b/.test(normalized)
  const is900 = /A\s*350[\s-]*900\b/.test(normalized)

  if (is1000) return "A350-1000"
  if (is900) return "A350-900"

  return null
}

export async function setFlaps(setting: number) {
  try {
    const { telemetry, aircraftTitle } = useTelemetryStore.getState()
    const currentSpeed = telemetry?.ias ?? 0
    const isOnGround = telemetry?.onGround ?? 0
    const variant = getA350Variant(aircraftTitle ?? undefined)

    const effectiveVariant: A350Variant = variant ?? "A350-900"

    const speedLimit = flapSpeedLimits[effectiveVariant][setting]

    console.log(
      `[Flaps] Aircraft=${variant ?? "Unknown"} | IAS=${currentSpeed}kts | Flap=${setting} | Limit=${speedLimit}`,
      telemetry
    )

    if (speedLimit && currentSpeed > speedLimit) {
      console.warn(`[Flaps] Denied: ${currentSpeed}kts exceeds ${speedLimit}kts for ${effectiveVariant}`)
      playSound("check_speed.ogg")
      return
    }

    const keyEvent = keyEventMap[setting]
    if (!keyEvent) {
      console.error("[Flaps] Invalid flap setting:", setting)
      return
    }

    const commandExpression = `1 (>K:${keyEvent})`

    if (!isOnGround) {
      playSound("speed_checked.ogg")

      await delay(1000)
      await mobiflightSet(commandExpression)

      console.log(`[Flaps] Command sent: ${keyEvent} | Expression: ${commandExpression}`)

      await delay(1000)
      const sound = soundMap[setting]
      if (sound) playSound(sound)
    } else {
      await mobiflightSet(commandExpression)

      console.log(`[Flaps] Command sent: ${keyEvent} | Expression: ${commandExpression}`)

      await delay(1000)
      const sound = soundMap[setting]
      if (sound) playSound(sound)
    }
  } catch (error) {
    console.error("[Flaps] Error setting flaps:", error)
  }
}
