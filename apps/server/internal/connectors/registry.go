package connectors

import (
	"fmt"
	"sync"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

// Registry builds and caches connectors. One connector instance serves every
// account of a provider: credentials are passed per call, so a connector holds
// no per-account state and is safe for concurrent use.
//
// It is a factory rather than a lookup table because the upstream dialect and
// endpoint come from the catalog at call time, not from a fixed provider list.
type Registry struct {
	codecs *transform.Registry

	mu    sync.RWMutex
	cache map[key]core.Connector
}

// key identifies one connector instance: a provider may legitimately appear
// with several dialects or base URLs (e.g. a custom endpoint per region).
type key struct {
	providerID string
	dialect    core.Dialect
	baseURL    string
}

// New builds the connector factory over the codec registry.
func New(codecs *transform.Registry) *Registry {
	if codecs == nil {
		codecs = transform.DefaultRegistry()
	}
	return &Registry{codecs: codecs, cache: map[key]core.Connector{}}
}

// For returns a cached connector for providerID speaking dialect with the given
// default base URL. An unknown dialect is an error: the gateway must not
// dispatch to a provider it cannot speak to.
func (r *Registry) For(providerID string, dialect core.Dialect, baseURL string) (core.Connector, error) {
	codec, err := r.codecs.Codec(dialect)
	if err != nil {
		return nil, fmt.Errorf("connectors: provider %q: %w", providerID, err)
	}

	k := key{providerID: providerID, dialect: dialect, baseURL: baseURL}

	r.mu.RLock()
	c, ok := r.cache[k]
	r.mu.RUnlock()
	if ok {
		return c, nil
	}

	c = &connector{
		id:          providerID,
		dialect:     dialect,
		defaultBase: baseURL,
		codec:       codec,
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if existing, ok := r.cache[k]; ok {
		return existing, nil
	}
	r.cache[k] = c
	return c, nil
}
