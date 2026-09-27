package services

import (
	"runtime"
	"sync"
	"time"
)

// SystemService samples host/process/runtime metrics for the dashboard
// system page, keeping a rolling in-memory history like IDRouter's
// system resources feed.
type SystemService struct {
	mu      sync.Mutex
	history SystemHistory
	booted  time.Time
}

// SystemPoint is one timestamped metric sample (unix millis).
type SystemPoint struct {
	Time  int64   `json:"time"`
	Value float64 `json:"value"`
}

// SystemHistory is the rolling window of the four charted series.
type SystemHistory struct {
	HostCpu    []SystemPoint `json:"hostCpu"`
	HostMemory []SystemPoint `json:"hostMemory"`
	ProcessCpu []SystemPoint `json:"processCpu"`
	ProcessRss []SystemPoint `json:"processRss"`
}

// SystemStats is the GET /v1/system/stats payload, matching the web UI
// SystemStats model.
type SystemStats struct {
	Host    SystemHost    `json:"host"`
	Process SystemProcess `json:"process"`
	Runtime SystemRuntime `json:"runtime"`
	Cores   []SystemCore  `json:"cores"`
	History SystemHistory `json:"history"`
}

type SystemHost struct {
	Hostname          string  `json:"hostname"`
	OS                string  `json:"os"`
	Architecture      string  `json:"architecture"`
	CPUCores          int     `json:"cpuCores"`
	CPUPercent        float64 `json:"cpuPercent"`
	MemoryTotalMb     float64 `json:"memoryTotalMb"`
	MemoryUsedMb      float64 `json:"memoryUsedMb"`
	MemoryPercent     float64 `json:"memoryPercent"`
	MemoryAvailableMb float64 `json:"memoryAvailableMb"`
	DiskTotalGb       float64 `json:"diskTotalGb"`
	DiskUsedGb        float64 `json:"diskUsedGb"`
	DiskFreeGb        float64 `json:"diskFreeGb"`
	DiskPercent       float64 `json:"diskPercent"`
	UptimeSeconds     uint64  `json:"uptimeSeconds"`
}

type SystemProcess struct {
	PID                int     `json:"pid"`
	CPUPercent         float64 `json:"cpuPercent"`
	RssMb              float64 `json:"rssMb"`
	RssPercent         float64 `json:"rssPercent"`
	Goroutines         int     `json:"goroutines"`
	Threads            int     `json:"threads"`
	OpenFds            int     `json:"openFds"`
	NetworkConnections int     `json:"networkConnections"`
}

type SystemRuntime struct {
	HeapAllocMb    float64 `json:"heapAllocMb"`
	HeapSysMb      float64 `json:"heapSysMb"`
	HeapInUseMb    float64 `json:"heapInUseMb"`
	HeapIdleMb     float64 `json:"heapIdleMb"`
	GCCycles       uint32  `json:"gcCycles"`
	GCPauseTotalMs float64 `json:"gcPauseTotalMs"`
	GCPauseLastMs  float64 `json:"gcPauseLastMs"`
}

type SystemCore struct {
	ID      int     `json:"id"`
	Percent float64 `json:"percent"`
}

// historyLimit mirrors the web mock's rolling window; sampleDivider scales
// per-core CPU samples to a host-level percentage.
const historyLimit = 60

var sampleDivider = float64(runtime.NumCPU())

func NewSystemService() *SystemService {
	return &SystemService{booted: time.Now()}
}

// Stats samples current metrics and appends them to the rolling history.
func (s *SystemService) Stats() (SystemStats, error) {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	stats := SystemStats{
		Host: SystemHost{
			Hostname:     hostName,
			OS:           runtime.GOOS,
			Architecture: runtime.GOARCH,
			CPUCores:     runtime.NumCPU(),
		},
		Process: SystemProcess{
			PID:        pid,
			Goroutines: runtime.NumGoroutine(),
		},
		Runtime: SystemRuntime{
			HeapAllocMb:    bToMb(ms.HeapAlloc),
			HeapSysMb:      bToMb(ms.HeapSys),
			HeapInUseMb:    bToMb(ms.HeapInuse),
			HeapIdleMb:     bToMb(ms.HeapIdle),
			GCCycles:       ms.NumGC,
			GCPauseTotalMs: float64(ms.PauseTotalNs) / 1e6,
		},
	}
	if ms.NumGC > 0 {
		stats.Runtime.GCPauseLastMs = float64(ms.PauseNs[(ms.NumGC-1)%256]) / 1e6
	}

	// gopsutil probes are best-effort: metric collection must never fail the
	// endpoint, so probe errors degrade to zero values.
	if host, err := hostInfo(); err == nil {
		stats.Host.Hostname = host.Hostname
		stats.Host.OS = host.OS + " " + host.Platform
		stats.Host.UptimeSeconds = host.Uptime
	}
	if vm, err := memVirtual(); err == nil {
		stats.Host.MemoryTotalMb = bToMb(vm.Total)
		stats.Host.MemoryUsedMb = bToMb(vm.Used)
		stats.Host.MemoryAvailableMb = bToMb(vm.Available)
		if vm.Total > 0 {
			stats.Host.MemoryPercent = round1(float64(vm.Used) / float64(vm.Total) * 100)
		}
	}
	if du, err := diskUsage("/"); err == nil && du.Total > 0 {
		stats.Host.DiskTotalGb = round1(float64(du.Total) / 1e9)
		stats.Host.DiskUsedGb = round1(float64(du.Used) / 1e9)
		stats.Host.DiskFreeGb = round1(float64(du.Free) / 1e9)
		stats.Host.DiskPercent = round1(float64(du.Used) / float64(du.Total) * 100)
	}
	if cpuPercent, err := cpuPercentSample(); err == nil && len(cpuPercent) > 0 {
		stats.Host.CPUPercent = round1(cpuPercent[0])
		for i, p := range cpuPercent {
			stats.Cores = append(stats.Cores, SystemCore{ID: i, Percent: round1(p)})
		}
	}
	if proc, err := procInfo(); err == nil {
		stats.Process.PID = proc.PID
		stats.Process.RssMb = round1(float64(proc.RSS) / 1e6)
		if stats.Host.MemoryTotalMb > 0 {
			stats.Process.RssPercent = round1(stats.Process.RssMb / stats.Host.MemoryTotalMb * 100)
		}
		stats.Process.CPUPercent = round1(proc.CPUPercent)
		stats.Process.OpenFds = proc.OpenFDs
		stats.Process.Threads = int(proc.Threads)
		stats.Process.NetworkConnections = proc.Connections
	}

	s.mu.Lock()
	s.appendLocked(SystemPoint{Time: time.Now().UnixMilli(), Value: stats.Host.CPUPercent}, &s.history.HostCpu)
	s.appendLocked(SystemPoint{Time: time.Now().UnixMilli(), Value: stats.Host.MemoryPercent}, &s.history.HostMemory)
	s.appendLocked(SystemPoint{Time: time.Now().UnixMilli(), Value: stats.Process.CPUPercent}, &s.history.ProcessCpu)
	s.appendLocked(SystemPoint{Time: time.Now().UnixMilli(), Value: stats.Process.RssMb}, &s.history.ProcessRss)
	stats.History = s.snapshotLocked()
	s.mu.Unlock()

	return stats, nil
}

func (s *SystemService) appendLocked(p SystemPoint, series *[]SystemPoint) {
	*series = append(*series, p)
	if len(*series) > historyLimit {
		*series = (*series)[len(*series)-historyLimit:]
	}
}

func (s *SystemService) snapshotLocked() SystemHistory {
	return SystemHistory{
		HostCpu:    append([]SystemPoint{}, s.history.HostCpu...),
		HostMemory: append([]SystemPoint{}, s.history.HostMemory...),
		ProcessCpu: append([]SystemPoint{}, s.history.ProcessCpu...),
		ProcessRss: append([]SystemPoint{}, s.history.ProcessRss...),
	}
}

func bToMb(b uint64) float64 { return float64(b) / 1024 / 1024 }

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}
