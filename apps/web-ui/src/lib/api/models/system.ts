export interface SystemPoint {
  /** Epoch milliseconds of the sample */
  time: number
  value: number
}

export interface SystemHost {
  hostname: string
  os: string
  architecture: string
  cpuCores: number
  cpuPercent: number
  memoryTotalMb: number
  memoryUsedMb: number
  memoryPercent: number
  memoryAvailableMb: number
  diskTotalGb: number
  diskUsedGb: number
  diskFreeGb: number
  diskPercent: number
  uptimeSeconds: number
}

export interface SystemProcess {
  pid: number
  cpuPercent: number
  rssMb: number
  rssPercent: number
  goroutines: number
  threads: number
  openFds: number
  networkConnections: number
}

export interface SystemRuntime {
  heapAllocMb: number
  heapSysMb: number
  heapInUseMb: number
  heapIdleMb: number
  gcCycles: number
  gcPauseTotalMs: number
  gcPauseLastMs: number
}

export interface SystemCore {
  id: number
  percent: number
}

export interface SystemHistory {
  hostCpu: SystemPoint[]
  hostMemory: SystemPoint[]
  processCpu: SystemPoint[]
  processRss: SystemPoint[]
}

export interface SystemStats {
  host: SystemHost
  process: SystemProcess
  runtime: SystemRuntime
  cores: SystemCore[]
  history: SystemHistory
}
