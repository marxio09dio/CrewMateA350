import { useEffect, useRef } from "react"

import { simvarSet } from "@/API/simvarApi"
import { useTelemetryStore } from "@/store/telemetryStore"

const COOLDOWN_MS = 500

/**
 * Keeps the FO baro unit selector (inHg / hPa) in sync with the Captain's
 * when the aircraft's linked-instruments setting is off (linkedInstruments = 0).
 *
 * When linkedInstruments >= 1 the aircraft's own sync is active and we do
 * nothing.
 *
 * Note: the actual baro pressure value is read-only via SimConnect, so only
 * the unit selector LVAR (XMLVAR_BARO_Selector_HPA_2) is written.
 */
export function useBaroSync() {
  const lastWriteRef = useRef<number>(0)

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const t = state.telemetry
      if (!t) return

      if (t.linkedInstruments !== 0) return

      const cptBaro = t.cptBaro
      const foBaro = t.foBaro
      if (cptBaro === undefined || foBaro === undefined) return
      if (cptBaro === foBaro) return

      const now = Date.now()
      if (now - lastWriteRef.current < COOLDOWN_MS) return

      lastWriteRef.current = now
      void simvarSet(`${cptBaro} (>L:XMLVAR_BARO_Selector_HPA_2)`)
    })

    return unsubscribe
  }, [])
}
