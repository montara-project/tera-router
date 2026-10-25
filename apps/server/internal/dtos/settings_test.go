package dtos

import (
	"strings"
	"testing"
)

func TestValidateBrandingImage(t *testing.T) {
	ok := []string{"", "data:image/png;base64,iVBORw0KGgo=", "data:image/svg+xml;base64,PHN2Zy8+"}
	for _, v := range ok {
		if err := ValidateBrandingImage("logo", &v); err != nil {
			t.Errorf("%q rejected: %v", v, err)
		}
	}
	bad := []string{
		"https://example.com/logo.png",
		"data:text/html;base64,PGgxPg==",
		"data:image/png;base64,not base64!",
		"data:image/png;base64," + strings.Repeat("A", MaxBrandingImageBytes),
	}
	for _, v := range bad {
		if err := ValidateBrandingImage("logo", &v); err == nil {
			t.Errorf("%.40q accepted", v)
		}
	}
	if err := ValidateBrandingImage("logo", nil); err != nil {
		t.Errorf("absent field rejected: %v", err)
	}
}
