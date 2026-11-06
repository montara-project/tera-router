package middlewares

import (
	"io"

	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

// BodyLimit caps request bodies at max bytes. The server streams request
// bodies (fiber StreamRequestBody) so that a database restore can upload a
// file bigger than any fixed buffer; fasthttp then no longer rejects large
// bodies itself, and this middleware is where the cap lives.
//
// exempt names the paths that skip the cap. They must parse their own body
// after authentication (the restore handler streams its upload to disk), and
// the server must set DisablePreParseMultipartForm, or fasthttp would read a
// multipart body of any size before any middleware runs.
func BodyLimit(max int, exempt func(path string) bool) fiber.Handler {
	errTooLarge := apperr.New(apperr.KindPayloadTooLarge, "request body is larger than %d MiB", max>>20)
	// The unread rest of the body is still on the connection; close it after
	// the response, as fasthttp does for an oversized body, or its bytes would
	// be read as the next request.
	tooLarge := func(c fiber.Ctx) error {
		c.RequestCtx().SetConnectionClose()
		return errTooLarge
	}

	return func(c fiber.Ctx) error {
		if exempt != nil && exempt(c.Path()) {
			return c.Next()
		}
		req := &c.RequestCtx().Request
		if req.Header.ContentLength() > max {
			return tooLarge(c)
		}
		// A chunked body has no length up front: read at most max+1 bytes to
		// tell, and hand the handlers the buffered body.
		if req.Header.ContentLength() == -1 && req.IsBodyStream() {
			body, err := io.ReadAll(io.LimitReader(req.BodyStream(), int64(max)+1))
			if err != nil {
				return apperr.New(apperr.KindBadRequest, "read request body: %s", err.Error())
			}
			if len(body) > max {
				return tooLarge(c)
			}
			req.SetBody(body)
		}
		return c.Next()
	}
}
