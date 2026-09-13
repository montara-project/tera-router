import { type AxiosItemResponse } from '@/types/api'

import type { Models } from '../models'
import type { SystemHistory, SystemPoint } from '../models/system'

const path = '/v1/system'

/**
 * The system endpoint is not available on the server yet, so this service
 * simulates realistic live metrics in-memory (random walk + rolling history)
 * following the shape a real GET /v1/system/stats would return.
 */
const HISTORY_LIMIT = 60
const SAMPLE_INTERVAL_MS = 5000

const BOOT_UPTIME_SECONDS = 5 * 86_400 + 20 * 3_600 + 18 * 60

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Mean-reverting random walk step */
function walk(value: number, min: number, max: number, step: number) {
  const pull = (min + max) / 2
  const next = value + (pull - value) * 0.1 + (Math.random() - 0.5) * step
  return clamp(next, min, max)
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function makePoint(time: number, value: number): SystemPoint {
  return { time, value: round(value) }
}

const hostname = Array.from({ length: 6 }, () =>
  Math.floor(Math.random() * 256)
    .toString(16)
    .padStart(2, '0')
).join('')

let bootedAt = Date.now()
let uptimeSeconds = BOOT_UPTIME_SECONDS
let hostCpu = 6.7
let hostMemoryPercent = 30.2
let diskUsedGb = 10.4
let goroutines = 39
let openFds = 50
let networkConnections = 34
let processCpu = 0.4
let processRssMb = 203
let heapAllocMb = 13.3
let heapInUseMb = 18.7
let gcCycles = 4535
let gcPauseTotalMs = 1199.5
let gcPauseLastMs = 0.07

const MEMORY_TOTAL_MB = 3724
const DISK_TOTAL_GB = 58.9
const CPU_CORES = 2

function seedHistory(): SystemHistory {
  const now = Date.now()
  const times = Array.from(
    { length: HISTORY_LIMIT },
    (_, i) => now - (HISTORY_LIMIT - 1 - i) * SAMPLE_INTERVAL_MS
  )

  return {
    hostCpu: times.map((time, i) => {
      const spike = i > HISTORY_LIMIT * 0.8 && i < HISTORY_LIMIT * 0.85 ? 14 : 0
      return makePoint(time, walk(6 + spike, 2, 15, 4))
    }),
    hostMemory: times.map((time, i) => {
      const drift = i > HISTORY_LIMIT * 0.85 ? 2.5 : 0
      return makePoint(time, walk(29 + drift, 28, 33, 1))
    }),
    processCpu: times.map((time) => makePoint(time, Math.max(0, Math.random() * 0.8))),
    processRss: times.map((time, i) => {
      const base = i > HISTORY_LIMIT * 0.82 ? processRssMb : 75 + Math.random() * 4
      return makePoint(time, base)
    }),
  }
}

let history: SystemHistory = seedHistory()

function pushSample(key: keyof SystemHistory, value: number) {
  const series = history[key]
  series.push(makePoint(Date.now(), value))
  if (series.length > HISTORY_LIMIT) series.shift()
}

function sample() {
  const now = Date.now()
  uptimeSeconds = BOOT_UPTIME_SECONDS + Math.floor((now - bootedAt) / 1000)

  hostCpu = walk(hostCpu, 2, 15, 4)
  hostMemoryPercent = walk(hostMemoryPercent, 28, 33, 1)
  diskUsedGb = clamp(diskUsedGb + Math.random() * 0.01, 10.4, 11)
  goroutines = Math.round(walk(goroutines, 30, 60, 6))
  openFds = Math.round(walk(openFds, 45, 70, 4))
  networkConnections = Math.round(walk(networkConnections, 28, 40, 5))
  processCpu = Math.max(0, walk(processCpu, 0, 2, 0.8))
  processRssMb = walk(processRssMb, 195, 215, 6)
  heapAllocMb = walk(heapAllocMb, 12, 20, 1.2)
  heapInUseMb = walk(heapInUseMb, 16, 24, 1.5)
  gcPauseLastMs = Math.max(0.01, walk(gcPauseLastMs, 0.02, 0.5, 0.2))
  gcPauseTotalMs += gcPauseLastMs
  gcCycles += 1

  pushSample('hostCpu', hostCpu)
  pushSample('hostMemory', hostMemoryPercent)
  pushSample('processCpu', processCpu)
  pushSample('processRss', processRssMb)

  const memoryUsedMb = (hostMemoryPercent / 100) * MEMORY_TOTAL_MB
  const rssPercent = (processRssMb / MEMORY_TOTAL_MB) * 100

  const stats: Models.SystemStats = {
    host: {
      hostname,
      os: 'debian 12.15',
      architecture: 'x86_64',
      cpuCores: CPU_CORES,
      cpuPercent: round(hostCpu),
      memoryTotalMb: MEMORY_TOTAL_MB,
      memoryUsedMb: round(memoryUsedMb, 0),
      memoryPercent: round(hostMemoryPercent),
      memoryAvailableMb: round(MEMORY_TOTAL_MB - memoryUsedMb, 0),
      diskTotalGb: DISK_TOTAL_GB,
      diskUsedGb: round(diskUsedGb),
      diskFreeGb: round(DISK_TOTAL_GB - diskUsedGb),
      diskPercent: round((diskUsedGb / DISK_TOTAL_GB) * 100),
      uptimeSeconds,
    },
    process: {
      pid: 1,
      cpuPercent: round(processCpu),
      rssMb: round(processRssMb),
      rssPercent: round(rssPercent),
      goroutines,
      threads: 12,
      openFds,
      networkConnections,
    },
    runtime: {
      heapAllocMb: round(heapAllocMb),
      heapSysMb: 506.8,
      heapInUseMb: round(heapInUseMb),
      heapIdleMb: 488.0,
      gcCycles,
      gcPauseTotalMs: round(gcPauseTotalMs),
      gcPauseLastMs: round(gcPauseLastMs, 2),
    },
    cores: Array.from({ length: CPU_CORES }, (_, id) => ({
      id,
      percent: round(clamp(hostCpu + (id === 0 ? 1.5 : -1.5) + Math.random() * 2, 0, 100)),
    })),
    history,
  }

  return stats
}

function stats(): Promise<AxiosItemResponse<Models.SystemStats>> {
  const response = {
    data: {
      data: sample(),
      metadata: {},
    },
  } as AxiosItemResponse<Models.SystemStats>

  return Promise.resolve(response)
}

export const systemServices = {
  path,
  stats,
}
