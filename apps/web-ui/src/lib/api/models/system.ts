export interface SystemPoint {
  /** Epoch milliseconds of the sample */
  time: number
  value: number
}

export interface SystemHost {
  hostname: string
  os: string
  architecture: string
  cpu_cores: number
  cpu_percent: number
  memory_total_mb: number
  memory_used_mb: number
  memory_percent: number
  memory_available_mb: number
  disk_total_gb: number
  disk_used_gb: number
  disk_free_gb: number
  disk_percent: number
  uptime_seconds: number
}

export interface SystemProcess {
  pid: number
  cpu_percent: number
  rss_mb: number
  rss_percent: number
  goroutines: number
  threads: number
  open_fds: number
  network_connections: number
}

export interface SystemRuntime {
  heap_alloc_mb: number
  heap_sys_mb: number
  heap_in_use_mb: number
  heap_idle_mb: number
  gc_cycles: number
  gc_pause_total_ms: number
  gc_pause_last_ms: number
}

export interface SystemCore {
  id: number
  percent: number
}

export interface SystemHistory {
  host_cpu: SystemPoint[]
  host_memory: SystemPoint[]
  process_cpu: SystemPoint[]
  process_rss: SystemPoint[]
}

export interface SystemStats {
  host: SystemHost
  process: SystemProcess
  runtime: SystemRuntime
  cores: SystemCore[]
  history: SystemHistory
}

export interface SystemHealth {
  machine_id: number
  status: string
  version: string
  system_info: {
    debug: boolean
  }
}
