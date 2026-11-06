package handlers

import (
	"fmt"

	"tera-router/server/internal/consolelog"
	"tera-router/server/internal/dtos"
)

// consoleInfof logs a formatted info line into the console feed.
func consoleInfof(format string, args ...any) {
	consolelog.Push(dtos.LogLevelInfo, fmt.Sprintf(format, args...), "")
}
