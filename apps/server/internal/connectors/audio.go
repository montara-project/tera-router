package connectors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"slices"

	"tera-router/server/internal/core"
)

// Speech (TTS) and transcription (STT) drivers. OpenAI's audio API is the
// reference shape: OpenAI, Groq and OpenAI-compatible custom providers take it
// verbatim; ElevenLabs and Deepgram are translated here.

// Audio capability names, matching the catalog's Capabilities values.
const (
	SpeechCapability        = "tts"
	TranscriptionCapability = "stt"
)

// audioProviders lists the catalog providers with an audio driver and the
// capabilities each serves. Custom providers are not listed: an
// OpenAI-compatible one serves both through the OpenAI shape.
var audioProviders = map[string][]string{
	"openai":     {SpeechCapability, TranscriptionCapability},
	"groq":       {TranscriptionCapability},
	"elevenlabs": {SpeechCapability, TranscriptionCapability},
	"deepgram":   {SpeechCapability, TranscriptionCapability},
}

// SupportsAudio reports whether provider can serve the audio capability.
// customOpenAI marks an operator-added OpenAI-compatible provider.
func SupportsAudio(provider, capability string, customOpenAI bool) bool {
	if caps, ok := audioProviders[provider]; ok {
		return slices.Contains(caps, capability)
	}
	return customOpenAI
}

// SpeechRequest is the OpenAI /audio/speech body.
type SpeechRequest struct {
	Model          string  `json:"model"`
	Input          string  `json:"input"`
	Voice          string  `json:"voice"`
	ResponseFormat string  `json:"response_format,omitempty"`
	Speed          float64 `json:"speed,omitempty"`
}

// Raw is an upstream response relayed to the client as-is.
type Raw struct {
	Body        []byte
	ContentType string
}

// TranscriptionRequest is one audio file to transcribe.
type TranscriptionRequest struct {
	Model    string
	Language string
	Prompt   string
	File     []byte
	Filename string
	FileType string
}

// Speech synthesizes req.Input on provider. defaultBase is the provider's
// base URL; an account base_url overrides it.
func Speech(ctx context.Context, provider, defaultBase string, creds core.Credentials, req SpeechRequest) (Raw, error) {
	c := call{provider: provider, model: req.Model, accountID: creds.AccountID, creds: creds}
	base := baseURL(defaultBase, creds)
	key := creds.Token()

	var (
		endpoint string
		body     any
		headers  map[string]string
	)
	switch provider {
	case "elevenlabs":
		// The voice is an ElevenLabs voice id; OpenAI voice names do not exist there.
		if req.Voice == "" {
			return Raw{}, c.badRequest("voice is required: an ElevenLabs voice id")
		}
		endpoint = joinURL(base, "text-to-speech/"+url.PathEscape(req.Voice))
		body = map[string]any{"text": req.Input, "model_id": req.Model}
		headers = map[string]string{"xi-api-key": key, "Accept": "audio/mpeg"}
	case "deepgram":
		// Deepgram's model names the voice (aura-2-thalia-en).
		endpoint = joinURL(base, "speak") + "?model=" + url.QueryEscape(req.Model)
		body = map[string]any{"text": req.Input}
		headers = map[string]string{"Authorization": "Token " + key}
	default:
		endpoint = joinURL(base, "audio/speech")
		body = req
		headers = map[string]string{"Authorization": bearer(key)}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return Raw{}, c.internal(err)
	}
	resp, err := doRequest(ctx, c, http.MethodPost, endpoint, payload, mergeHeaders(headers, creds.Headers))
	if err != nil {
		return Raw{}, err
	}
	return Raw{Body: resp.body, ContentType: resp.contentType}, nil
}

// Transcribe returns the text spoken in req.File.
func Transcribe(ctx context.Context, provider, defaultBase string, creds core.Credentials, req TranscriptionRequest) (string, error) {
	c := call{provider: provider, model: req.Model, accountID: creds.AccountID, creds: creds}
	base := baseURL(defaultBase, creds)
	key := creds.Token()

	var (
		endpoint string
		payload  []byte
		headers  map[string]string
		err      error
	)
	switch provider {
	case "elevenlabs":
		endpoint = joinURL(base, "speech-to-text")
		headers = map[string]string{"xi-api-key": key}
		payload, headers["Content-Type"], err = multipartBody(req, map[string]string{"model_id": req.Model, "language_code": req.Language})
	case "deepgram":
		// Deepgram takes the raw audio as the body and options as query params.
		q := url.Values{"model": {req.Model}, "smart_format": {"true"}}
		if req.Language != "" {
			q.Set("language", req.Language)
		}
		endpoint = joinURL(base, "listen") + "?" + q.Encode()
		payload = req.File
		headers = map[string]string{"Authorization": "Token " + key, "Content-Type": req.FileType}
	default:
		endpoint = joinURL(base, "audio/transcriptions")
		headers = map[string]string{"Authorization": bearer(key)}
		payload, headers["Content-Type"], err = multipartBody(req, map[string]string{
			"model": req.Model, "language": req.Language, "prompt": req.Prompt, "response_format": "json",
		})
	}
	if err != nil {
		return "", c.internal(err)
	}

	resp, err := doRequest(ctx, c, http.MethodPost, endpoint, payload, mergeHeaders(headers, creds.Headers))
	if err != nil {
		return "", err
	}

	var out struct {
		Text    string `json:"text"`
		Results struct {
			Channels []struct {
				Alternatives []struct {
					Transcript string `json:"transcript"`
				} `json:"alternatives"`
			} `json:"channels"`
		} `json:"results"`
	}
	if err := json.Unmarshal(resp.body, &out); err != nil {
		return "", c.internal(fmt.Errorf("decode %s transcription: %w", provider, err))
	}
	if ch := out.Results.Channels; len(ch) > 0 && len(ch[0].Alternatives) > 0 {
		return ch[0].Alternatives[0].Transcript, nil
	}
	return out.Text, nil
}

// multipartBody renders the file plus the non-empty fields as a
// multipart/form-data body, returning it with its Content-Type.
func multipartBody(req TranscriptionRequest, fields map[string]string) ([]byte, string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		if v != "" {
			if err := w.WriteField(k, v); err != nil {
				return nil, "", err
			}
		}
	}
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, req.Filename))
	h.Set("Content-Type", req.FileType)
	part, err := w.CreatePart(h)
	if err != nil {
		return nil, "", err
	}
	if _, err := part.Write(req.File); err != nil {
		return nil, "", err
	}
	if err := w.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), w.FormDataContentType(), nil
}

// badRequest reports a request the provider cannot serve as given.
func (c call) badRequest(msg string) *core.ProviderError {
	return &core.ProviderError{Kind: core.ErrBadRequest, Provider: c.provider, Model: c.model, AccountID: c.accountID, Message: msg}
}
