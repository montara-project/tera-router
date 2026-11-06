package main

import (
	"io"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"tera-router/server/internal/middlewares"

	sentryfiber "github.com/gofiber/contrib/v3/sentry"
	"github.com/gofiber/fiber/v3"
)

// countingBody streams up to n zero bytes and records how many were taken.
type countingBody struct {
	n, read atomic.Int64
}

func (b *countingBody) Read(p []byte) (int, error) {
	left := b.n.Load() - b.read.Load()
	if left <= 0 {
		return 0, io.EOF
	}
	if int64(len(p)) > left {
		p = p[:left]
	}
	clear(p)
	b.read.Add(int64(len(p)))
	return len(p), nil
}

// An unauthenticated upload to the uncapped restore path must not be read
// before auth refuses it. Sentry buffers the whole body, so it is skipped on
// that path; the control route shows what happens without the skip.
func TestRestorePathBodyIsNotReadBeforeAuth(t *testing.T) {
	const size = 96 << 20
	app := fiber.New(fiber.Config{
		BodyLimit:                    bodyLimit,
		StreamRequestBody:            true,
		DisablePreParseMultipartForm: true,
		ErrorHandler:                 middlewares.ErrorHandler,
	})
	sentry := sentryfiber.New(sentryfiber.Config{})
	app.Use(middlewares.BodyLimit(bodyLimit, func(p string) bool { return p == databaseRestorePath || p == "/control" }))
	app.Use(skipFor(databaseRestorePath, sentry))
	// Stand-in for RequireAuth: no session, so every request is refused.
	deny := func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusUnauthorized) }
	app.Post(databaseRestorePath, deny)
	app.Post("/control", deny)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true}) }()
	t.Cleanup(func() { _ = app.Shutdown() })

	upload := func(path string) int64 {
		t.Helper()
		body := &countingBody{}
		body.n.Store(size)
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, "http://"+ln.Addr().String()+path, body)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/octet-stream")
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s: status %d, want 401", path, resp.StatusCode)
			}
		}
		// A refused upload may also end in a write error once the server
		// closes the connection; either way, count what it took.
		return body.read.Load()
	}

	if read := upload(databaseRestorePath); read > 16<<20 {
		t.Errorf("restore path: the client sent %d MiB before the 401, want the body left unread", read>>20)
	}
	if read := upload("/control"); read < size {
		t.Errorf("control: Sentry read %d MiB, expected the whole %d MiB body", read>>20, size>>20)
	}
}
