// Package gateway is the inference edge of tera-router: it authenticates
// inbound API keys, parses requests with the client's dialect codec, resolves
// the requested model to an ordered list of provider/model targets, plans
// accounts, runs the attempt loop (with same-account retry and target
// fallback), and renders the result back in the client's dialect — unary or
// as a relayed SSE stream.
//
// It serves POST /v1/chat/completions (OpenAI Chat), POST /v1/messages and
// POST /v1/messages/count_tokens (Anthropic Messages), POST /v1/responses
// + POST /responses (OpenAI Responses), and GET /v1/models (OpenAI-shaped
// listing that advertises the aliases, chains, and auto-combo ids a client
// may route to).
package gateway

import (
	"log/slog"
	"sync"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/autocombo"
	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"

	"github.com/gofiber/fiber/v3"
)

const (
	// routingDeadline bounds the database work done before dispatch (model
	// resolution, plan lookup, budget check, account planning).
	routingDeadline = 15 * time.Second

	// unaryDeadline bounds a non-streaming request. Failing fast with a
	// meaningful 504 beats waiting for an intermediary proxy to give up.
	unaryDeadline = 90 * time.Second
	// streamDeadline bounds a streaming request end-to-end. Slow upstreams can
	// take well over 90s to first byte.
	streamDeadline = 3 * time.Minute

	// maxAttempts caps how many provider/account attempts a single request may
	// consume, bounding CPU and upstream load when a model has many accounts.
	maxAttempts = 10

	// sameAccountRetries is how many times a transient upstream fault
	// (ErrUpstream/ErrTimeout) is retried on the same account before falling
	// back to the next target.
	sameAccountRetries = 2
	// retryBackoffBase is the first same-account retry delay; it doubles per
	// attempt (500ms, 1s) and is skipped when the request deadline is close.
	retryBackoffBase = 500 * time.Millisecond
	// retryDeadlineFloor is the minimum time that must remain after a backoff
	// sleep for the retried call to have a chance of finishing.
	retryDeadlineFloor = 10 * time.Second

	// cooldownRateLimit is how long an account is skipped after a 429 when the
	// upstream sends no Retry-After.
	cooldownRateLimit = 30 * time.Second
	// cooldownAuth is how long an account is skipped after the upstream
	// rejected its credential or suspended it.
	cooldownAuth = 5 * time.Minute

	// heartbeatInterval is how often an SSE comment is written while waiting
	// for the first upstream chunk.
	heartbeatInterval = 15 * time.Second

	// defaultMaxConcurrent caps how many inference requests may be in flight at
	// once. Each request holds upstream connections and buffer slots, and the
	// first request for a key additionally runs an argon2 verification (64 MiB,
	// 4 threads), so an unbounded queue would let a traffic spike exhaust the
	// process. Inference traffic is not rate-limited per IP the way the
	// dashboard is — coding agents legitimately burst from one address — so the
	// bounded resource is concurrency, and a saturated gateway answers 503
	// immediately rather than queueing.
	defaultMaxConcurrent = 100
)

// Server holds the gateway's dependencies and serves the inference routes.
type Server struct {
	app    *app.Application
	log    *slog.Logger
	codecs *transform.Registry
	conns  *connectors.Registry

	// rotation is the per-chain round-robin cursor, keyed by chain name.
	rotation rotationState
	// combo builds the virtual auto-combo target lists for "auto" requests
	// and consumes the attempt loop's failure/success accounting for
	// self-healing exclusions.
	combo *autocombo.Engine
	// cooldowns tracks accounts parked after a rate-limit/auth failure.
	cooldowns cooldownTracker
	// auth caches verified inbound API keys so argon2 runs once per key per TTL.
	auth authCache
	// inflight bounds concurrent inference requests. A request holds its slot
	// for its whole life, including the stream writer phase that runs after the
	// handler returns.
	inflight chan struct{}
	// metering counts the asynchronous usage writes that have not reached the
	// database yet, so a shutdown (or a test teardown) can wait for the
	// accounting of already-served requests instead of racing it.
	metering sync.WaitGroup
}

// New builds the gateway server over the application container. The codec
// registry is the transform default registry; connectors are built from it.
func New(a *app.Application) *Server {
	codecs := transform.DefaultRegistry()
	return &Server{
		app:       a,
		log:       a.Logger,
		codecs:    codecs,
		conns:     connectors.New(codecs),
		rotation:  newRotationState(),
		combo:     autocombo.NewEngine(autocombo.RepoAccounts{R: a.Repos.Accounts}, autocombo.RepoStats{R: a.Repos.Usage}, autocombo.RepoCatalog{R: a.Repos.Settings}),
		cooldowns: newCooldownTracker(),
		auth:      newAuthCache(),
		inflight:  make(chan struct{}, defaultMaxConcurrent),
	}
}

// Drain waits for the in-flight metering writes to reach the database. The
// server calls it during shutdown so a process exit cannot drop the accounting
// of requests it already answered.
func (s *Server) Drain() { s.metering.Wait() }

// acquire reserves an in-flight slot, reporting false when the gateway is at
// capacity. The returned release func must be called exactly once.
func (s *Server) acquire() (func(), bool) {
	select {
	case s.inflight <- struct{}{}:
		return func() { <-s.inflight }, true
	default:
		return nil, false
	}
}

// Register mounts the inference routes on the app. It must be called BEFORE
// the dashboard's authenticated /v1 group so the dashboard's JWT middleware
// does not intercept inference traffic.
//
// Middleware is attached per route rather than to a group: a Fiber group's Use
// handlers match by path prefix, so a `/v1` group would also wrap the
// dashboard's `/v1/*` routes and reject its JWT-authenticated traffic with 401.
// The in-flight concurrency limit is enforced inside the handler instead, so a
// stream keeps its slot until the last byte is written rather than until the
// handler returns.
//
// `/responses` is registered at the root as well as under /v1 because
// Responses-native clients (Codex) address it either way.
//
// It returns the server so the caller can Drain pending metering writes during
// shutdown.
func Register(r *fiber.App, a *app.Application) *Server {
	s := New(a)

	r.Post("/v1/chat/completions", s.authMiddleware, s.handleOpenAIChat)
	r.Post("/v1/messages", s.authMiddleware, s.handleAnthropicMessages)
	r.Post("/v1/messages/count_tokens", s.authMiddleware, s.handleAnthropicCountTokens)
	r.Post("/v1/responses", s.authMiddleware, s.handleOpenAIResponses)
	r.Post("/responses", s.authMiddleware, s.handleOpenAIResponses)
	r.Get("/v1/models", s.authMiddleware, s.handleListModels)
	return s
}

// GatewayRoutes lists the inference endpoints. It is exported so the server
// wiring can exempt them from dashboard middleware (IP rate limiting) and from
// response compression, which would buffer SSE.
var GatewayRoutes = []string{
	"/v1/chat/completions",
	"/v1/messages",
	"/v1/messages/count_tokens",
	"/v1/responses",
	"/responses",
	"/v1/models",
}

// IsGatewayPath reports whether a request path is served by the inference
// gateway.
func IsGatewayPath(path string) bool {
	for _, p := range GatewayRoutes {
		if path == p {
			return true
		}
	}
	return false
}

// codec resolves the codec for a dialect, or nil when unregistered.
func (s *Server) codec(d core.Dialect) transform.Codec {
	c, err := s.codecs.Codec(d)
	if err != nil {
		return nil
	}
	return c
}
