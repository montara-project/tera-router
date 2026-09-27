package services

import (
	"os"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

// hostName and pid are stable per-process identifiers.
var (
	hostName, _ = os.Hostname()
	pid         = os.Getpid()
)

type hostInfoResult struct {
	Hostname string
	OS       string
	Platform string
	Uptime   uint64
}

func hostInfo() (hostInfoResult, error) {
	info, err := host.Info()
	if err != nil {
		return hostInfoResult{}, err
	}
	return hostInfoResult{
		Hostname: info.Hostname,
		OS:       info.OS,
		Platform: info.Platform + " " + info.PlatformVersion,
		Uptime:   info.Uptime,
	}, nil
}

func memVirtual() (*mem.VirtualMemoryStat, error) {
	return mem.VirtualMemory()
}

func diskUsage(path string) (*disk.UsageStat, error) {
	return disk.Usage(path)
}

func cpuPercentSample() ([]float64, error) {
	return cpu.Percent(0, true)
}

type procInfoResult struct {
	PID         int
	CPUPercent  float64
	RSS         uint64
	Threads     int32
	OpenFDs     int
	Connections int
}

func procInfo() (procInfoResult, error) {
	p, err := process.NewProcess(int32(pid))
	if err != nil {
		return procInfoResult{}, err
	}

	result := procInfoResult{PID: int(pid)}

	if cpu, err := p.CPUPercent(); err == nil {
		result.CPUPercent = cpu / sampleDivider
	}
	if mem, err := p.MemoryInfo(); err == nil {
		result.RSS = mem.RSS
	}
	if threads, err := p.NumThreads(); err == nil {
		result.Threads = threads
	}
	if fds, err := p.NumFDs(); err == nil {
		result.OpenFDs = int(fds)
	}

	if conns, err := net.Connections("inet"); err == nil {
		result.Connections = len(conns)
	}

	// gopsutil's NumFDs is unsupported on some platforms; fall back to the
	// raw /proc-adjacent syscall count via process limits where available.
	if result.OpenFDs == 0 {
		result.OpenFDs = openFDsFallback(p)
	}
	return result, nil
}

func openFDsFallback(p *process.Process) int {
	fds, err := p.NumFDs()
	if err != nil {
		return 0
	}
	return int(fds)
}
