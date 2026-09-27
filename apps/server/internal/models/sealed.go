package models

// Sealed holds the envelope-encrypted pair for one secret blob.
type Sealed struct {
	WrappedDEK string `json:"wrapped_dek"`
	Ciphertext string `json:"ciphertext"`
}

// Empty reports whether the pair carries no recoverable secret.
func (s Sealed) Empty() bool { return s.WrappedDEK == "" || s.Ciphertext == "" }
