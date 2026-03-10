import { useGoAroundStore } from "@/store/goAroundStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import { setFlaps } from "./flaps"

export async function executeGoAround() {
  const flapsIndex = Math.round(useTelemetryStore.getState().telemetry?.flapsIndex ?? 0)
  const target = Math.max(1, flapsIndex - 1)
  useGoAroundStore.getState().trigger()
  await setFlaps(target, true)
}
