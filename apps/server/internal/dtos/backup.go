package dtos

import "tera-router/server/internal/lib/validator"

// ConfigExport is the body of POST /v1/backup/config/export. A non-empty
// passphrase makes the backup portable: credentials are re-keyed from the
// local APP_SECRET to the passphrase so another install can import them.
type ConfigExport struct {
	Passphrase string `json:"passphrase"`
}

func (d *ConfigExport) Validate(v *validator.MapValidator) {
	v.Field("passphrase").String()
}
