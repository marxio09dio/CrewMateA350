import { simvarSet } from "@/API/simvarApi"

export async function setGPU(on: boolean) {
  try {
    await simvarSet(`${on ? 1 : 0} (>L:INI_GPU_AVAIL)`)
  } catch (error) {
    console.error("Error setting GPU (LVAR):", error)
  }
}

export async function setASU(on: boolean) {
  try {
    await simvarSet(`${on ? 1 : 0} (>L:INI_ASU_AVAIL)`)
  } catch (error) {
    console.error("Error setting ASU (LVAR):", error)
  }
}

export async function setACU(on: boolean) {
  try {
    await simvarSet(`${on ? 1 : 0} (>L:INI_ACU_AVAIL)`)
  } catch (error) {
    console.error("Error setting ACU (LVAR):", error)
  }
}

export async function disconnectAllGround() {
  try {
    await simvarSet("0 (>L:INI_GPU_AVAIL)")
    await simvarSet("0 (>L:INI_ASU_AVAIL)")
    await simvarSet("0 (>L:INI_ACU_AVAIL)")
  } catch (error) {
    console.error("Error disconnecting all ground services (LVAR):", error)
  }
}
