package lib

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

func validationErr(t *testing.T, err error) *ErrValidationFailed {
	t.Helper()
	var ve *ErrValidationFailed
	if !errors.As(err, &ve) {
		t.Fatalf("expected ErrValidationFailed, got %v", err)
	}
	return ve
}

func runBody(t *testing.T, body string, obj Validatable) error {
	t.Helper()
	app := fiber.New()
	var out error
	app.Post("/t", func(c fiber.Ctx) error {
		out = ValidateRequestBody(c, obj)
		if out != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"err": out.Error()})
		}
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest("POST", "/t", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()
	return out
}

func runQuery(t *testing.T, target string, obj Validatable) error {
	t.Helper()
	app := fiber.New()
	var out error
	app.Get("/t", func(c fiber.Ctx) error {
		out = ValidateRequestQuery(c, obj)
		if out != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"err": out.Error()})
		}
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest("GET", target, nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()
	return out
}

func TestValidateRequestQuery_OptionalDefaultsPass(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t", q); err != nil {
		t.Fatalf("empty query should pass, got %v", err)
	}
}

func TestValidateRequestQuery_InvalidOrderFails(t *testing.T) {
	err := runQuery(t, "/t?order=sideways", &dtos.ListQuery{})
	validationErr(t, err)
}

func TestValidateRequestQuery_ValidParamsPass(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t?offset=20&limit=10&order=asc", q); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q.Offset != 20 || q.Limit != 10 || q.Order != "asc" {
		t.Fatalf("query not bound: %+v", q)
	}
}

func TestValidateRequestQuery_EmptyParamTreatedAsAbsent(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t?order=", q); err != nil {
		t.Fatalf("empty order should pass like an absent param, got %v", err)
	}
}
