package dtos

import "tera-router/server/internal/lib/validator"

// ProxyPool is the proxy pool create/update request body
// (POST /v1/proxy-pools).
type ProxyPool struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Mode  string `json:"mode"`
	Label string `json:"label"`
	// Bypass is a comma separated host list that skips the proxy.
	Bypass string `json:"bypass"`
	// Enabled and Strict are optional; omitted keeps the stored value
	// (enabled, not strict for a new pool).
	Enabled *bool `json:"enabled"`
	Strict  *bool `json:"strict"`
}

func (d *ProxyPool) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("url").Required().String()
}

// ProxyPoolBulk is the batch import body (POST /v1/proxy-pools/bulk).
type ProxyPoolBulk struct {
	Pools []ProxyPool `json:"pools"`
}

func (d *ProxyPoolBulk) Validate(v *validator.MapValidator) {
	v.Field("pools").Required()
}

// ProxyPoolBulkDelete lists the pools to delete
// (POST /v1/proxy-pools/bulk-delete).
type ProxyPoolBulkDelete struct {
	IDs []string `json:"ids"`
}

func (d *ProxyPoolBulkDelete) Validate(v *validator.MapValidator) {
	v.Field("ids").Required()
}

// RelayScript asks for a relay script (POST /v1/proxy-pools/relay-script).
// Kind is "cloudflare" or "local".
type RelayScript struct {
	Kind string `json:"kind"`
}

func (d *RelayScript) Validate(v *validator.MapValidator) {
	v.Field("kind").Required().String()
}
