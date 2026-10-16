package connectors

import (
	"context"
	"encoding/json"
	"net/http"

	"tera-router/server/internal/core"
)

// Image generation and embeddings use OpenAI's request and response shape on
// every provider that serves them, so the body is passed through with only
// the model rewritten — provider-specific extras (NVIDIA's input_type, Jina's
// task) reach the upstream untouched.

// Media capability names, matching the catalog's Capabilities values.
const (
	ImageCapability     = "image"
	EmbeddingCapability = "embeddings"
)

// OpenAIPost sends body as JSON to {base}/{path} with bearer auth and returns
// the upstream response unchanged.
func OpenAIPost(ctx context.Context, provider, defaultBase string, creds core.Credentials, path string, body map[string]any) (Raw, error) {
	model, _ := body["model"].(string)
	c := call{provider: provider, model: model, accountID: creds.AccountID, creds: creds}
	payload, err := json.Marshal(body)
	if err != nil {
		return Raw{}, c.internal(err)
	}
	headers := mergeHeaders(map[string]string{"Authorization": bearer(creds.Token())}, creds.Headers)
	resp, err := doRequest(ctx, c, http.MethodPost, joinURL(baseURL(defaultBase, creds), path), payload, headers)
	if err != nil {
		return Raw{}, err
	}
	return Raw{Body: resp.body, ContentType: resp.contentType}, nil
}
