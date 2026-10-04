package models

import "tera-router/server/internal/lib/sealer"

// Sealed is the persisted envelope-encrypted secret pair. It is the sealer's
// own type so credentials need no conversion at the persistence boundary.
type Sealed = sealer.Sealed
