package gateway

import (
	"net/http"
	"strings"
	"testing"
)

// Embeddings and image generation pass the OpenAI body through with only the
// model rewritten, relay the response unchanged, and meter reported tokens;
// Jina AI serves embeddings from the catalog; a chat-only provider is a 400.
func TestImagesAndEmbeddings(t *testing.T) {
	fiberApp, a := newGatewayApp(t)
	auth := map[string]string{"Authorization": "Bearer " + testKeyPlaintext}

	up := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/embeddings" {
			_, _ = w.Write([]byte(`{"object":"list","data":[{"embedding":[0.1,0.2]}],"usage":{"prompt_tokens":7,"total_tokens":7}}`))
			return
		}
		_, _ = w.Write([]byte(`{"created":1,"data":[{"b64_json":"aW1n"}]}`))
	})
	registerProvider(t, a, "gpu", up.server.URL, "gpu-key")

	resp := do(t, fiberApp, http.MethodPost, "/v1/embeddings",
		`{"model":"gpu/embed-small","input":"hello","input_type":"query"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusOK || !strings.Contains(body, `"embedding":[0.1,0.2]`) {
		t.Fatalf("embeddings: status %d body %s", resp.StatusCode, body)
	}
	if got := up.captured()[0]; got.Path != "/embeddings" || got.Body["model"] != "embed-small" || got.Body["input_type"] != "query" {
		t.Errorf("embeddings upstream request = %+v", got)
	}
	assertUsageTokens(t, a, "gpu", "embed-small", 7, 0)

	resp = do(t, fiberApp, http.MethodPost, "/v1/images/generations",
		`{"model":"gpu/flux-schnell","prompt":"a red fox","size":"1024x1024"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusOK || !strings.Contains(body, `"b64_json":"aW1n"`) {
		t.Fatalf("images: status %d body %s", resp.StatusCode, body)
	}
	if got := up.captured()[1]; got.Path != "/images/generations" || got.Body["model"] != "flux-schnell" || got.Body["size"] != "1024x1024" {
		t.Errorf("images upstream request = %+v", got)
	}

	jina := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"embedding":[1]}],"usage":{"prompt_tokens":3}}`))
	})
	addWebAccount(t, a, "jina-ai", jina.server.URL, "jina-key", 100)
	resp = do(t, fiberApp, http.MethodPost, "/v1/embeddings", `{"model":"jina-ai/jina-embeddings-v3","input":["x"]}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusOK || jina.captured()[0].Headers.Get("Authorization") != "Bearer jina-key" {
		t.Fatalf("jina embeddings: status %d body %s", resp.StatusCode, body)
	}

	resp = do(t, fiberApp, http.MethodPost, "/v1/images/generations", `{"model":"anthropic/claude-x","prompt":"x"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("chat-only provider: status %d body %s", resp.StatusCode, body)
	}
}
