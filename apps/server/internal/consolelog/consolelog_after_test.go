package consolelog

import (
	"testing"

	"tera-router/server/internal/dtos"
)

// ListAfter hands a polling client only the lines it has not seen, and the
// oldest id still kept so it can drop trimmed and cleared lines.
func TestListAfter(t *testing.T) {
	Clear()
	t.Cleanup(Clear)

	var ids []int64
	for range 5 {
		Push(dtos.LogLevelInfo, "line", "")
		ids = append(ids, List()[len(List())-1].ID)
	}

	got, first := ListAfter(ids[1])
	if len(got) != 3 || got[0].ID != ids[2] || got[2].ID != ids[4] {
		t.Fatalf("after %d: got %d entries %v, want ids %v", ids[1], len(got), got, ids[2:])
	}
	if first != ids[0] {
		t.Errorf("first = %d, want %d", first, ids[0])
	}
	if got, _ := ListAfter(ids[4]); len(got) != 0 {
		t.Errorf("after the newest id: got %d entries, want 0", len(got))
	}

	// Past capacity the oldest lines drop, and first moves with them.
	for range Capacity {
		Push(dtos.LogLevelInfo, "fill", "")
	}
	if _, first := ListAfter(0); first <= ids[4] {
		t.Errorf("after trimming, first = %d, want past %d", first, ids[4])
	}

	// A clear leaves only newer ids, so a client drops everything it holds.
	Clear()
	Push(dtos.LogLevelInfo, "Console cleared", "")
	got, first = ListAfter(ids[4])
	if len(got) != 1 || first != got[0].ID || first <= ids[4] {
		t.Errorf("after clear: %d entries, first %d", len(got), first)
	}
}
