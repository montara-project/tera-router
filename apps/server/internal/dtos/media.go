package dtos

// MediaProvider is one media-capable provider entry, ported from IDRouter's
// connectors media catalog.
type MediaProvider struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Slug         string   `json:"slug"`
	Capabilities []string `json:"capabilities"`
}
