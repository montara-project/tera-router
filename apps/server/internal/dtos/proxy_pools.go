package dtos

import "tera-router/server/internal/lib/validator"

// ProxyPool is the proxy pool create/update request body
// (POST/PUT/PATCH /v1/proxy-pools).
type ProxyPool struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Mode  string `json:"mode"`
	Label string `json:"label"`
}

func (d *ProxyPool) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("url").Required().String()
}
