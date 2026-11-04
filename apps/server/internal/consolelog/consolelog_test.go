package consolelog

import (
	"testing"
	"time"

	"tera-router/server/internal/dtos"
)

func TestRingKeepsNewestAndIDsKeepGrowing(t *testing.T) {
	Clear()
	for range Capacity + 5 {
		Push(dtos.LogLevelInfo, "line", "")
	}
	got := List()
	if len(got) != Capacity {
		t.Fatalf("len = %d, want %d", len(got), Capacity)
	}
	if got[len(got)-1].ID-got[0].ID != Capacity-1 {
		t.Errorf("ids not contiguous: first %d last %d", got[0].ID, got[len(got)-1].ID)
	}

	last := got[len(got)-1].ID
	Clear()
	id := PushEntry(dtos.ConsoleEntry{Level: dtos.LogLevelWarn, Message: "x"}, time.Date(2026, 1, 2, 3, 4, 5, 6e6, time.UTC))
	if id != last+1 {
		t.Errorf("id after clear = %d, want %d", id, last+1)
	}
	if e := List()[0]; e.Time != "03:04:05.006" || e.Level != dtos.LogLevelWarn {
		t.Errorf("entry = %+v", e)
	}
}
