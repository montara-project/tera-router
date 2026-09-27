package handlers

import (
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
)

// toModelsSealed converts the lib sealer type into the persisted models type.
func toModelsSealed(s sealer.Sealed) models.Sealed {
	return models.Sealed{WrappedDEK: s.WrappedDEK, Ciphertext: s.Ciphertext}
}

// fromModelsSealed converts a stored sealed pair back into the lib type.
func fromModelsSealed(s models.Sealed) sealer.Sealed {
	return sealer.Sealed{WrappedDEK: s.WrappedDEK, Ciphertext: s.Ciphertext}
}
