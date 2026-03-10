import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const gearLowerSpeedLimit = 255 // knots

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function setGearHandle(position: number) {
  try {
    const { telemetry } = useTelemetryStore.getState()
    const currentSpeed = telemetry?.ias ?? 0

    if (position === 1 && currentSpeed > gearLowerSpeedLimit) {
      playSound("check_speed.ogg")
      return
    }

    const eventName = position === 1 ? "GEAR_DOWN" : "GEAR_UP"
    const commandExpression = `(>K:${eventName})`

    if (position === 1) {
      playSound("speed_checked.ogg")
      await delay(1000)
      await simvarSet(commandExpression)

      await delay(1000)
      playSound("gear_down.ogg")
    } else {
      await simvarSet(commandExpression)
      playSound(position === 1 ? "gear_down.ogg" : "gear_up.ogg")
    }
  } catch (error) {
    console.error("Error sending gear key event:", error)
  }
}
