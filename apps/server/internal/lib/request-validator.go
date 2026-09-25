package lib

import (
	"encoding/json"
	"fmt"

	"tera-router/server/internal/lib/validator"

	"github.com/gofiber/fiber/v3"
)

type ErrValidationFailed struct {
	MessageRecord validator.MessageRecord
}

func (e ErrValidationFailed) Error() string {
	return fmt.Sprintf("%v", e.MessageRecord)
}

type Validatable interface {
	Validate(v *validator.MapValidator)
}

// ValidateRequestQuery validates the raw query map before binding it into
// obj, so optional parameters that are absent stay absent.
func ValidateRequestQuery(c fiber.Ctx, obj Validatable) error {
	data := make(map[string]interface{}, len(c.Queries()))
	for key, val := range c.Queries() {
		data[key] = val
	}
	dropEmpty(data)

	if err := validateDict(obj, data); err != nil {
		return err
	}

	return c.Bind().Query(obj)
}

// ValidateRequestBody validates the raw JSON object before binding it into
// obj, so optional fields that are absent stay absent (an empty struct field
// would otherwise fail rules like Email/WithinS). An empty body is treated
// as an empty object.
func ValidateRequestBody(c fiber.Ctx, obj Validatable) error {
	body := c.Body()

	data := make(map[string]interface{})
	if len(body) > 0 {
		if err := json.Unmarshal(body, &data); err != nil {
			return err
		}
	}
	dropEmpty(data)

	if err := validateDict(obj, data); err != nil {
		return err
	}

	if len(body) == 0 {
		return nil
	}
	return c.Bind().Body(obj)
}

// dropEmpty removes empty-string values so an explicit "" is validated like
// an absent key: optional format/enum rules skip it and Required still
// rejects it. The struct binding still sees the original value.
func dropEmpty(data map[string]interface{}) {
	for key, val := range data {
		if s, ok := val.(string); ok && s == "" {
			delete(data, key)
		}
	}
}

func validateDict(obj Validatable, data map[string]interface{}) error {
	v := validator.NewMapValidator()
	obj.Validate(v)

	mr, passed := v.Validate(data)
	if !passed {
		return &ErrValidationFailed{MessageRecord: mr}
	}

	return nil
}

func WrapValidationError(mr validator.MessageRecord) map[string]interface{} {
	return map[string]interface{}{
		"message": "validation failed",
		"errors":  mr,
	}
}
