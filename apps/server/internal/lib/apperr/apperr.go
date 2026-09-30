// Package apperr provides typed application errors that map to HTTP status
// codes. The Fiber error handler in cmd/api renders them into the response
// envelope the web UI expects: {"message": "...", "errors": [...]}.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
)

type Kind int

const (
	KindBadRequest Kind = iota
	KindUnauthorized
	KindForbidden
	KindNotFound
	KindConflict
	KindUnprocessable
	KindTooManyRequests
	KindInternal
)

var kindStatus = map[Kind]int{
	KindBadRequest:      http.StatusBadRequest,
	KindUnauthorized:    http.StatusUnauthorized,
	KindForbidden:       http.StatusForbidden,
	KindNotFound:        http.StatusNotFound,
	KindConflict:        http.StatusConflict,
	KindUnprocessable:   http.StatusUnprocessableEntity,
	KindTooManyRequests: http.StatusTooManyRequests,
	KindInternal:        http.StatusInternalServerError,
}

// Error is a typed application error. Wrap sentinel errors (ErrNotFound, …)
// with fmt.Errorf("%w: detail", ErrNotFound) and use From to recover the kind.
type Error struct {
	Kind    Kind
	Message string
}

func (e *Error) Error() string { return e.Message }

// Sentinels cover the common cases so services can return them directly.
var (
	ErrBadRequest      = &Error{Kind: KindBadRequest, Message: "bad request"}
	ErrUnauthorized    = &Error{Kind: KindUnauthorized, Message: "unauthorized"}
	ErrForbidden       = &Error{Kind: KindForbidden, Message: "forbidden"}
	ErrNotFound        = &Error{Kind: KindNotFound, Message: "resource not found"}
	ErrConflict        = &Error{Kind: KindConflict, Message: "resource conflict"}
	ErrUnprocessable   = &Error{Kind: KindUnprocessable, Message: "unprocessable entity"}
	ErrTooManyRequests = &Error{Kind: KindTooManyRequests, Message: "too many requests"}
	ErrInternal        = &Error{Kind: KindInternal, Message: "internal server error"}
)

// New builds a typed error with a custom message.
func New(kind Kind, format string, args ...any) *Error {
	return &Error{Kind: kind, Message: fmt.Sprintf(format, args...)}
}

// Status returns the HTTP status code for the error.
func (e *Error) Status() int { return kindStatus[e.Kind] }

// From resolves an arbitrary error into (status, message). A wrapped *Error
// keeps its kind and message; anything else degrades to 500 with a generic
// message so internals never leak to clients.
func From(err error) (int, string) {
	if err == nil {
		return http.StatusOK, ""
	}

	var ae *Error
	if errors.As(err, &ae) {
		return ae.Status(), ae.Message
	}

	// Wrapped sentinels match via errors.Is.
	switch {
	case errors.Is(err, ErrNotFound):
		return ErrNotFound.Status(), ErrNotFound.Message
	case errors.Is(err, ErrUnauthorized):
		return ErrUnauthorized.Status(), ErrUnauthorized.Message
	case errors.Is(err, ErrForbidden):
		return ErrForbidden.Status(), ErrForbidden.Message
	case errors.Is(err, ErrConflict):
		return ErrConflict.Status(), ErrConflict.Message
	case errors.Is(err, ErrBadRequest):
		return ErrBadRequest.Status(), ErrBadRequest.Message
	case errors.Is(err, ErrUnprocessable):
		return ErrUnprocessable.Status(), ErrUnprocessable.Message
	case errors.Is(err, ErrTooManyRequests):
		return ErrTooManyRequests.Status(), ErrTooManyRequests.Message
	default:
		return ErrInternal.Status(), ErrInternal.Message
	}
}
