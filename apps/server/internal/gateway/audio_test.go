package gateway

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
)

// Speech routes "provider/model" to an OpenAI-compatible custom provider and
// relays its audio; transcription translates to Deepgram's raw-body API and
// normalizes the transcript; a provider without the capability is a 400.
func TestAudioSpeechAndTranscription(t *testing.T) {
	fiberApp, a := newGatewayApp(t)
	auth := map[string]string{"Authorization": "Bearer " + testKeyPlaintext}

	tts := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write([]byte("ID3fake-mp3"))
	})
	registerProvider(t, a, "voicebox", tts.server.URL, "vb-key")

	resp := do(t, fiberApp, http.MethodPost, "/v1/audio/speech",
		`{"model":"voicebox/tts-1","input":"hello","voice":"alloy"}`, auth)
	body := readBody(t, resp)
	if resp.StatusCode != http.StatusOK || body != "ID3fake-mp3" || resp.Header.Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("speech: status %d type %q body %q", resp.StatusCode, resp.Header.Get("Content-Type"), body)
	}
	if got := tts.captured()[0]; got.Path != "/audio/speech" || got.Body["model"] != "tts-1" || got.Body["input"] != "hello" {
		t.Errorf("speech upstream request = %+v", got)
	}

	dg := newFakeUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"results":{"channels":[{"alternatives":[{"transcript":"hello world"}]}]}}`))
	})
	addWebAccount(t, a, "deepgram", dg.server.URL, "dg-key", 100)

	var form bytes.Buffer
	mw := multipart.NewWriter(&form)
	_ = mw.WriteField("model", "deepgram/nova-3")
	fw, _ := mw.CreateFormFile("file", "clip.wav")
	_, _ = fw.Write([]byte("RIFFfake-wav"))
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", &form)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+testKeyPlaintext)
	resp, err := fiberApp.Test(req, fiber.TestConfig{Timeout: 30 * time.Second})
	if err != nil {
		t.Fatal(err)
	}
	var got struct{ Text string }
	_ = json.Unmarshal([]byte(readBody(t, resp)), &got)
	if resp.StatusCode != http.StatusOK || got.Text != "hello world" {
		t.Fatalf("transcription: status %d text %q", resp.StatusCode, got.Text)
	}
	up := dg.captured()[0]
	if up.Path != "/listen" || up.Raw != "RIFFfake-wav" || up.Headers.Get("Authorization") != "Token dg-key" {
		t.Errorf("deepgram upstream request = %+v", up)
	}

	resp = do(t, fiberApp, http.MethodPost, "/v1/audio/speech", `{"model":"anthropic/claude-x","input":"hi"}`, auth)
	if body := readBody(t, resp); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("non-audio provider: status %d body %s", resp.StatusCode, body)
	}
}
