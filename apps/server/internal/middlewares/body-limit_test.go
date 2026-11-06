package middlewares

import (
	"bytes"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gofiber/fiber/v3"
)

// TestBodyLimit drives the middleware on an app configured like cmd/api:
// streamed bodies, no multipart pre-parsing, one exempt upload path.
func TestBodyLimit(t *testing.T) {
	const limit = 1024
	app := fiber.New(fiber.Config{
		ErrorHandler:                 ErrorHandler,
		BodyLimit:                    limit,
		StreamRequestBody:            true,
		DisablePreParseMultipartForm: true,
	})
	app.Use(BodyLimit(limit, func(p string) bool { return p == "/upload" }))
	app.Post("/echo", func(c fiber.Ctx) error {
		return c.SendString(strconv.Itoa(len(c.Body())))
	})
	app.Post("/upload", func(c fiber.Ctx) error {
		form, err := c.RequestCtx().Request.MultipartFormWithLimit(0)
		if err != nil {
			return err
		}
		return c.SendString(strconv.FormatInt(form.File["file"][0].Size, 10))
	})

	send := func(req *http.Request) (int, string) {
		t.Helper()
		resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
		if err != nil {
			t.Fatalf("%s: %v", req.URL.Path, err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(body)
	}
	sized := func(path string, n int) *http.Request {
		return httptest.NewRequest(http.MethodPost, path, bytes.NewReader(make([]byte, n)))
	}
	upload := func(path string, n int) *http.Request {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		part, _ := w.CreateFormFile("file", "big.db")
		_, _ = part.Write(make([]byte, n))
		_ = w.Close()
		req := httptest.NewRequest(http.MethodPost, path, &buf)
		req.Header.Set("Content-Type", w.FormDataContentType())
		return req
	}

	cases := []struct {
		name       string
		req        *http.Request
		wantStatus int
		wantBody   string
	}{
		{"under the limit", sized("/echo", 512), http.StatusOK, "512"},
		{"over the limit", sized("/echo", 4*limit), http.StatusRequestEntityTooLarge, ""},
		{"multipart over the limit elsewhere", upload("/echo", 4*limit), http.StatusRequestEntityTooLarge, ""},
		{"exempt upload over the limit", upload("/upload", 8*limit), http.StatusOK, strconv.Itoa(8 * limit)},
	}
	// fiber's app.Test always sets Content-Length, so chunked bodies go
	// through a real listener; http.Client sends an unknown length chunked.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true}) }()
	t.Cleanup(func() { _ = app.Shutdown() })
	for _, tc := range []struct {
		n          int
		wantStatus int
	}{{512, http.StatusOK}, {4 * limit, http.StatusRequestEntityTooLarge}} {
		body := io.MultiReader(bytes.NewReader(make([]byte, tc.n)))
		resp, err := http.Post("http://"+ln.Addr().String()+"/echo", "application/octet-stream", body)
		if err != nil {
			t.Fatalf("chunked %d bytes: %v", tc.n, err)
		}
		got, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != tc.wantStatus {
			t.Errorf("chunked %d bytes: status = %d, want %d: %s", tc.n, resp.StatusCode, tc.wantStatus, got)
		}
		if tc.wantStatus == http.StatusOK && string(got) != strconv.Itoa(tc.n) {
			t.Errorf("chunked %d bytes: handler saw %s bytes", tc.n, got)
		}
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := send(tc.req)
			if status != tc.wantStatus {
				t.Fatalf("status = %d, want %d: %s", status, tc.wantStatus, body)
			}
			if tc.wantBody != "" && body != tc.wantBody {
				t.Errorf("body = %q, want %q", body, tc.wantBody)
			}
		})
	}
}
