import { mobiflightSet } from "@/API/mobiflightApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const gearLowerSpeedLimit = 255 // knots

export async function setGearHandle(position: number) {
  try {
    const currentSpeed = useTelemetryStore.getState().telemetry?.ias ?? 0

    if (position === 1 && currentSpeed > gearLowerSpeedLimit) {
      console.warn(`Cannot lower gear: airspeed ${currentSpeed}kts exceeds limit of ${gearLowerSpeedLimit}kts`)
      playSound("check_speed.ogg")
      return
    }

    const eventName = position === 1 ? "GEAR_DOWN" : "GEAR_UP"
    const commandExpression = `1 (>K:${eventName})`

    await mobiflightSet(commandExpression)

    console.log("Sent gear key event:", eventName, "Expression:", commandExpression)

    playSound(position === 1 ? "gear_down.ogg" : "gear_up.ogg")
  } catch (error) {
    console.error("Error sending gear key event:", error)
  }
}
