import afterLanding from "@/data/flows/after_landing.json"
import afterStart from "@/data/flows/after_start.json"
import afterTakeoff from "@/data/flows/after_takeoff.json"
import beforeStart from "@/data/flows/before_start.json"
import beforeTakeoff from "@/data/flows/before_takeoff.json"
import beforeWalkaround from "@/data/flows/before_walkaround.json"
import clearLeft from "@/data/flows/clear_left.json"
import climbTenThousand from "@/data/flows/climb_ten_thousand_flow.json"
import curtains_close from "@/data/flows/curtains_close.json"
import curtains_open from "@/data/flows/curtains_open.json"
import descTenThousand from "@/data/flows/desc_ten_thousand_flow.json"
import electricPowerUp from "@/data/flows/electric_power_up.json"
import shutdown from "@/data/flows/shutdown.json"
import table_close from "@/data/flows/table_close.json"
import table_open from "@/data/flows/table_open.json"
import { simvarGet } from "@/API/simvarApi"
import { usePerformanceStore } from "@/store/performanceStore"
import type { Flow, FlowStep } from "@/types/flow"

export const allFlows: Flow[] = [
  electricPowerUp,
  beforeWalkaround,
  beforeStart,
  afterStart,
  clearLeft,
  beforeTakeoff,
  afterTakeoff,
  climbTenThousand,
  descTenThousand,
  afterLanding,
  shutdown,
  curtains_open,
  curtains_close,
  table_open,
  table_close
] as Flow[]

export function getFlowById(id: string): Flow | undefined {
  return allFlows.find((f) => f.id === id)
}

async function getTemplateVars(): Promise<Record<string, string>> {
  const { takeoff, landing } = usePerformanceStore.getState()
  const vars: Record<string, string> = {}

  // TO_FLAPS_CONF mapping: 2 → flaps 1, 3 → flaps 2, 5 → flaps 3
  const TO_FLAPS_MAP: Record<number, string> = { 2: "1", 3: "2", 5: "3" }
  try {
    const toFlapsConf = await simvarGet("(L:TO_FLAPS_CONF)")
    vars["flaps"] = toFlapsConf !== null ? (TO_FLAPS_MAP[toFlapsConf] ?? "") : ""
  } catch {
    vars["flaps"] = ""
  }

  const packsOn = takeoff.packs === "on"
  const apuPacks = takeoff.packs === "apu"
  vars["pack1_cmd"] = packsOn ? "1 (>L:INI_AIR_PACK1_BUTTON)" : "0 (>L:INI_AIR_PACK1_BUTTON)"
  vars["pack2_cmd"] = packsOn ? "1 (>L:INI_AIR_PACK2_BUTTON)" : "0 (>L:INI_AIR_PACK2_BUTTON)"
  vars["pack1_expect"] = packsOn ? "1" : "0"
  vars["pack2_expect"] = packsOn ? "1" : "0"
  vars["apu_bleed_cmd"] = apuPacks ? "1 (>L:INI_AIR_BLEED_APU)" : "0 (>L:INI_AIR_BLEED_APU)"
  vars["apu_bleed_expect"] = apuPacks ? "1" : "0"

  const antiIce = takeoff.antiIce ?? "off"
  const engAntiIce = antiIce === "oneng" || antiIce === "onengwing"
  const wingAntiIce = antiIce === "onengwing"

  vars["anti_ice_eng1_cmd"] = engAntiIce ? "1 (>L:INI_ENG_ANTI_ICE1_STATE)" : "0 (>L:INI_ENG_ANTI_ICE1_STATE)"
  vars["anti_ice_eng2_cmd"] = engAntiIce ? "1 (>L:INI_ENG_ANTI_ICE2_STATE)" : "0 (>L:INI_ENG_ANTI_ICE2_STATE)"
  vars["anti_ice_wing_cmd"] = wingAntiIce ? "1 (>L:INI_WING_ANTI_ICE1_STATE)" : "0 (>L:INI_WING_ANTI_ICE1_STATE)"
  vars["anti_ice_eng1_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_eng2_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_wing_expect"] = wingAntiIce ? "1" : "0"

  const landFlapsMap: Record<string, string> = {
    "3": "3",
    Full: "4"
  }
  vars["landing_flaps"] = landFlapsMap[landing.flaps] ?? "5"

  return vars
}

function resolveString(str: string, vars: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

export async function resolveStep(step: FlowStep, vars?: Record<string, string>): Promise<FlowStep> {
  const templateVars = vars ?? (await getTemplateVars())
  return {
    ...step,
    label: resolveString(step.label, templateVars),
    read: resolveString(step.read, templateVars),
    on: resolveString(step.on, templateVars),
    expect: typeof step.expect === "string" ? parseFloat(resolveString(step.expect, templateVars)) || 0 : step.expect
  }
}

export async function resolveFlow(flow: Flow): Promise<Flow> {
  const vars = await getTemplateVars()
  return {
    ...flow,
    steps: await Promise.all(flow.steps.map((s) => resolveStep(s, vars)))
  }
}
